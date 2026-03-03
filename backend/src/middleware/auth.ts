import { Context, Next } from "hono";
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";
import crypto from "crypto";


// Extend Hono context
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    organizationId: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
    };
  }
}

export async function authMiddleware(c: Context, next: Next) {
  try {
    // Get Authorization header
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      return c.json({ error: "Unauthorized: Missing or invalid token" }, 401);
    }

    const token = authHeader.split(/\s+/)[1];
    if (!token) {
      console.error("❌ Invalid Authorization header format");
      return c.json({ error: "Unauthorized: Invalid Authorization header" }, 401);
    }
    console.log("🔑 Token received, length:", token.length, "prefix:", token.substring(0, 20) + "...");

    let session;

    // STEP 1: Try direct database session lookup (most reliable for session tokens)
    try {
      const dbSession = await prisma.session.findFirst({
        where: {
          OR: [
            { id: token },
            { token: token }
          ],
          expiresAt: {
            gt: new Date() // Not expired
          }
        },
        include: { user: true }
      });

      if (dbSession && dbSession.user) {
        console.log("✅ DB session lookup successful for user:", dbSession.user.id);
        session = {
          user: dbSession.user,
          session: { expiresAt: dbSession.expiresAt }
        };
      }
    } catch (dbError: any) {
      console.error("❌ DB session lookup error:", dbError?.message);
    }

    // STEP 2: If DB lookup failed, try Better Auth getSession
    if (!session || !session.user) {
      try {
        session = await auth.api.getSession({
          headers: new Headers({
            Authorization: `Bearer ${token}`,
          }),
        });
        console.log("📋 Better Auth getSession result:", session ? "Valid" : "Invalid");
      } catch (sessionError: any) {
        console.error("❌ Better Auth getSession error:", sessionError?.message);
        session = null;
      }
    }

    // STEP 3: If both failed, try manual JWT decode (for actual JWTs)
    if (!session || !session.user) {
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          console.log("🔍 Attempting manual JWT decode...");
          // Base64URL to JSON
          const base64Url = parts[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString());

          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.error("❌ Manual check: Token expired at", new Date(payload.exp * 1000).toISOString());
            return c.json({ error: "Unauthorized: Token expired", code: "TOKEN_EXPIRED" }, 401);
          }

          if (!payload.id && !payload.sub) {
            console.error("❌ Manual check: No user ID found in payload");
          } else {
            session = {
              user: {
                id: payload.id || payload.sub,
                email: payload.email,
                name: payload.name,
              },
              session: {
                expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
              },
            };
            console.log("✅ Manual JWT decode successful for user:", session.user.email || session.user.id);
          }
        } catch (jwtError: any) {
          console.error("❌ Manual JWT decode failed:", jwtError?.message);
        }
      } else {
        console.warn("⚠️ Token is not a 3-part JWT, skipping manual decode");
      }
    }

    // STEP 4: All methods failed
    if (!session || !session.user) {
      console.error("❌ All auth methods failed for token type:", token.length > 50 ? "JWT-like" : "Opaque");
      return c.json({ error: "Unauthorized: Invalid or expired token" }, 401);
    }

    let userId = session.user.id;
    const userEmail = session.user.email;
    const userName = session.user.name;

    console.log("✅ User ID from session:", userId);
    console.log("📧 User email from session:", userEmail);

    // 🔧 CRITICAL FIX: If Better Auth session is valid, ensure user exists in database
    // Better Auth with JWT can have valid sessions even if user record is missing
    // We need to create the user if they don't exist (trust Better Auth's session validation)

    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
    });

    // If not found by ID, try finding by email (ID might have changed in session)
    if (!user && userEmail) {
      console.log("🔍 User not found by ID, searching by email:", userEmail);
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        include: {
          memberships: {
            include: {
              organization: true,
            },
            orderBy: {
              createdAt: "asc",
            },
            take: 1,
          },
        },
      });

      if (user) {
        console.log("✅ User found by email, updating userId from", userId, "to", user.id);
        userId = user.id; // Correct the ID for subsequent logic
      }
    }

    // If user doesn't exist at all, create them
    if (!user) {
      console.log("⚠️ User not found in database, creating from session...");
      console.log("📋 User data to create:", { userId, userEmail, userName });

      try {
        // Create user and organization in a single transaction
        const result = await prisma.$transaction(async (tx: any) => {
          // Double check email uniqueness just before creating
          if (userEmail) {
            const existing = await tx.user.findUnique({ where: { email: userEmail } });
            if (existing) {
              console.log("✅ User found by email inside transaction, skipping creation");
              return { user: existing, isNew: false };
            }
          }

          // Create user
          console.log("📝 Creating user in database...");
          const newUser = await tx.user.create({
            data: {
              id: userId,
              email: userEmail || `user-${userId}@temp.com`,
              name: userName || null,
              emailVerified: false,
            },
          });
          console.log("✅ User created:", newUser.id);

          // Create organization
          console.log("📝 Creating organization...");
          const orgId = crypto.randomUUID();
          const organization = await tx.organization.create({
            data: {
              id: orgId,
              name: `${userName || (userEmail ? userEmail.split('@')[0] : 'User')}'s Organization`,
              slug: orgId.toLowerCase(),
            },
          });

          console.log("✅ Organization created:", organization.id);

          // Create membership
          console.log("📝 Creating membership...");
          await tx.organizationMember.create({
            data: {
              id: crypto.randomUUID(),
              userId: newUser.id,
              organizationId: organization.id,
              role: "owner",
            },
          });

          console.log("✅ Membership created");

          return { user: newUser, organization, isNew: true };
        });

        if (userId !== result.user.id) {
          userId = result.user.id;
        }

        console.log(`✅ User ${result.isNew ? 'created' : 'verified'}:`, userId);

        // Re-fetch user with membership
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            memberships: {
              include: {
                organization: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
            },
          },
        });
      } catch (createError: any) {
        console.error("❌ Failed to create/initialize user:", createError?.message);
        return c.json({
          error: "Unauthorized: Failed to initialize user account",
          details: process.env.NODE_ENV === 'development' ? createError?.message : undefined
        }, 401);
      }
    }

    // 🔧 FIX: Auto-create organization if user doesn't have one
    // This handles edge cases where users were created before organization plugin was configured
    if (!user || !user.memberships || user.memberships.length === 0) {
      console.log("⚠️ User has no organization, creating one automatically...");

      try {
        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (tx: any) => {
          // 1. Ensure User Exists (Double Check inside Transaction)
          let txUser = await tx.user.findUnique({ where: { id: userId } });

          if (!txUser) {
            console.log("⚠️ User missing inside transaction, checking by email...");

            // Check if user exists by email (to avoid P2002 Unique Constraint violation)
            if (userEmail) {
              const existingUserByEmail = await tx.user.findUnique({ where: { email: userEmail } });
              if (existingUserByEmail) {
                console.log("✅ Found user by email, using existing user:", existingUserByEmail.id);
                txUser = existingUserByEmail;
              }
            }

            // If still no user, create one
            if (!txUser) {
              console.log("📝 Creating new user...");
              txUser = await tx.user.create({
                data: {
                  id: crypto.randomUUID(),
                  email: userEmail || `user-${userId}@temp.com`,
                  name: userName || null,
                  emailVerified: false
                }
              });

            }
          }

          // 2. Create a "Personal" organization for the user
          // Check if user already has an organization to avoid duplicates in this race condition
          const existingMember = await tx.organizationMember.findFirst({
            where: { userId: txUser.id },
            include: { organization: true }
          });

          if (existingMember) {
            console.log("✅ User already has an organization, skipping creation");
            return { organization: existingMember.organization, user: txUser };
          }

          console.log("📝 Creating new organization for user:", txUser.id);
          const orgId = crypto.randomUUID();
          const organization = await tx.organization.create({
            data: {
              id: orgId,
              name: `${userName || userEmail.split('@')[0]}'s Organization`,
              slug: orgId.toLowerCase(),
            },
          });


          // 3. Create membership linking user to organization
          await tx.organizationMember.create({
            data: {
              id: crypto.randomUUID(),
              userId: txUser.id, // Use the confirmed user ID
              organizationId: organization.id,
              role: "owner",
            },
          });


          return { organization, user: txUser };
        });

        console.log("✅ Created/Verified organization for user:", result.user.id);

        // Update userId in case it changed (e.g. found by email with different ID)
        if (userId !== result.user.id) {
          console.log(`⚠️ Updating userId from ${userId} to ${result.user.id} (found by email)`);
          userId = result.user.id;
        }

        // Re-fetch user with the new membership using the CORRECT userId
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            memberships: {
              include: {
                organization: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
            },
          },
        });
      } catch (txError: any) {
        console.error("❌ Failed to create organization:", {
          message: txError?.message,
          code: txError?.code,
          meta: txError?.meta,
        });

        throw txError; // Re-throw to be caught by outer catch
      }
    }

    // Ensure we have a valid organization at this point
    if (!user || !user.memberships || user.memberships.length === 0) {
      console.error("❌ Failed to create organization for user");
      return c.json(
        { error: "Unauthorized: Failed to initialize user organization" },
        401
      );
    }

    const organizationId = user.memberships[0].organizationId;
    console.log("✅ Organization ID:", organizationId); // Debug log

    // Attach to context
    c.set("userId", userId);
    c.set("organizationId", organizationId);
    c.set("user", {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

    console.log("✅ Auth middleware passed"); // Debug log
    await next();
  } catch (error: any) {
    console.error("❌ Auth middleware error:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500), // Truncate stack trace
    });
    return c.json({
      error: "Unauthorized: Token verification failed",
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, 401);
  }
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  try {
    const authHeader = c.req.header("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers
      });

      if (session && session.user) {
        c.set("userId", session.user.id);
        c.set("user", {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        });

        // Try to get organization
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          include: {
            memberships: {
              take: 1,
              orderBy: { createdAt: "asc" }
            },
          },
        });

        if (user?.memberships?.[0]) {
          c.set("organizationId", user.memberships[0].organizationId);
        }
      }
    }
  } catch (error) {
    console.error("Optional auth middleware error:", error);
  }

  await next();
}