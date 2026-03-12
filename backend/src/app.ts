// backend/src/app.ts
import { Hono } from "hono";
import { auth } from "./lib/auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import transactionRoutes from "./routes/transactions.routes";
import authRoutes from "./routes/auth.routes";
import { prisma } from "./lib/db";


export const app = new Hono();

// VERSION FOR VERIFICATION
const VERSION = "1.0.9-DIAGNOSTIC-FINAL";

// 1. BUILT-IN LOGGER
app.use("*", logger());

// 2. CLEAN & CORRECT CORS
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "https://vessify-frontend.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL,
      ].filter(Boolean) as string[];
      return allowed.includes(origin) ? origin : allowed[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Better-Auth",
      "X-Better-Auth-Organization-Id",
    ],
    credentials: true,
  })
);

// 3. DIAGNOSTICS
// Match both "/" and empty string for maximum reliability
app.get("/", (c) =>
  c.json({
    message: "Vessify Backend API",
    status: "running",
    version: VERSION,
    timestamp: new Date().toISOString(),
  })
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    version: VERSION,
  })
);

// Debug routes removed for production security
// Use Render dashboard logs for debugging



// 4. AUTH ROUTES
app.all("/api/auth/*", async (c) => {
  try {
    const res = await auth.handler(c.req.raw);
    return res;
  } catch (error) {
    return c.json({ error: "Authentication error", details: String(error) }, 500);
  }
});

app.route("/api/auth", authRoutes);

// 5. BUSINESS ROUTES
app.route("/api/transactions", transactionRoutes);

// 6. 404 HANDLER (JSON for structured debugging)
app.notFound((c) => {
  return c.json({
    error: "Route not found",
    method: c.req.method,
    path: c.req.path,
    version: VERSION
  }, 404);
});