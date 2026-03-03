import { Hono } from "hono"
import { prisma } from "../lib/db"
import { authMiddleware } from "../middleware/auth"
import { parseTransaction } from "../lib/parser"

const transactionRoutes = new Hono()

// All routes are protected
transactionRoutes.use("*", authMiddleware)

/**
 * POST /extract
 * Extract transaction from raw text and save to database
 * Body: { text: string }
 */
transactionRoutes.post("/extract", async (c) => {
  try {
    // Get user info from auth middleware
    const userId = c.get("userId")
    const organizationId = c.get("organizationId")

    if (!userId || !organizationId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Parse request body
    const body = await c.req.json()
    const { text } = body

    if (!text || typeof text !== "string") {
      return c.json({ error: "Text is required" }, 400)
    }

    // Parse transaction from text
    const parsed = parseTransaction(text)

    // Save transaction to database
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        organizationId,
        date: parsed.date,
        description: parsed.description,
        amount: parsed.amount,
        balance: parsed.balance,
        rawText: text, // Store original text for debugging
      },
    })

    // Return transaction with confidence score (always 1.0 for now)
    return c.json(
      {
        transaction: {
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          balance: transaction.balance,
          createdAt: transaction.createdAt,
        },
        confidence: 1.0,
      },
      201
    )
  } catch (error: any) {
    console.error("Extract transaction error:", error)

    // Handle parsing errors
    if (error.message?.includes("Please include") || error.message?.includes("parse")) {
      return c.json({ error: error.message }, 400)
    }

    return c.json({ error: "Failed to extract transaction" }, 500)
  }
})

/**
 * GET /
 * Get paginated transactions with cursor-based pagination
 * Query params: ?cursor=string&limit=number
 */
transactionRoutes.get("/", async (c) => {
  try {
    // Get user info from auth middleware
    const userId = c.get("userId")
    const organizationId = c.get("organizationId")

    if (!userId || !organizationId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Parse query parameters
    const cursor = c.req.query("cursor")
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 100) // Max 100, default 10

    // Build where clause with data isolation
    const where = {
      userId, // CRITICAL: Filter by userId from JWT
      organizationId, // CRITICAL: Filter by organizationId from JWT
      ...(cursor && {
        createdAt: {
          lt: new Date(cursor), // Cursor is the createdAt timestamp
        },
      }),
    }

    // Fetch transactions with cursor pagination
    const transactions = await prisma.transaction.findMany({
      where,
      take: limit + 1, // Fetch one extra to check if there's a next page
      orderBy: {
        createdAt: "desc", // Most recent first
      },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        balance: true,
        createdAt: true,
      },
    })

    // Check if there's a next page
    const hasNextPage = transactions.length > limit
    const result = hasNextPage ? transactions.slice(0, limit) : transactions

    // Get next cursor (createdAt of last item)
    const nextCursor = hasNextPage && result.length > 0
      ? result[result.length - 1].createdAt.toISOString()
      : null

    return c.json({
      transactions: result,
      nextCursor,
    })
  } catch (error: any) {
    console.error("Get transactions error:", error)
    return c.json({ error: "Failed to fetch transactions" }, 500)
  }
})

/**
 * GET /:id
 * Get a single transaction by ID
 * Verifies ownership before returning
 */
transactionRoutes.get("/:id", async (c) => {
  try {
    // Get user info from auth middleware
    const userId = c.get("userId")
    const organizationId = c.get("organizationId")

    if (!userId || !organizationId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Get transaction ID from params
    const id = c.req.param("id")

    // Fetch transaction with ownership verification
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId, // CRITICAL: Verify ownership
        organizationId, // CRITICAL: Verify organization access
      },
      select: {
        id: true,
        date: true,
        description: true,
        amount: true,
        balance: true,
        rawText: true,
        createdAt: true,
      },
    })

    // Check if transaction exists and user owns it
    if (!transaction) {
      return c.json({ error: "Transaction not found" }, 404)
    }

    return c.json({ transaction })
  } catch (error: any) {
    console.error("Get transaction error:", error)
    return c.json({ error: "Failed to fetch transaction" }, 500)
  }
})

/**
 * DELETE /:id
 * Delete a transaction by ID
 * Verifies ownership before deleting
 */
transactionRoutes.delete("/:id", async (c) => {
  try {
    // Get user info from auth middleware
    const userId = c.get("userId")
    const organizationId = c.get("organizationId")

    if (!userId || !organizationId) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    // Get transaction ID from params
    const id = c.req.param("id")

    // First verify ownership
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId, // CRITICAL: Verify ownership
        organizationId, // CRITICAL: Verify organization access
      },
    })

    // Check if transaction exists and user owns it
    if (!existingTransaction) {
      return c.json({ error: "Transaction not found" }, 404)
    }

    // Delete transaction
    await prisma.transaction.delete({
      where: {
        id,
      },
    })

    return c.json({ success: true })
  } catch (error: any) {
    console.error("Delete transaction error:", error)

    // Handle Prisma not found error
    if (error.code === "P2025") {
      return c.json({ error: "Transaction not found" }, 404)
    }

    return c.json({ error: "Failed to delete transaction" }, 500)
  }
})

export default transactionRoutes
