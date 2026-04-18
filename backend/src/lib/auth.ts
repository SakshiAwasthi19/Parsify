// ============================================
// BETTER AUTH CONFIGURATION
// Email + Password Authentication
// JWT Tokens (7-day expiry)
// Organizations/Teams (Multi-tenancy)
// ============================================

import "dotenv/config";
import fs from "fs";
import path from "path";

// ... existing imports ...
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization, jwt } from "better-auth/plugins";
import { prisma } from "./db";

// Debug logging to file
const logPath = path.join(process.cwd(), "debug_startup.log");
const logToFile = (msg: string) => {
    try { fs.appendFileSync(logPath, msg + "\n"); } catch (e) { }
};

// Configure Better Auth
const secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
const logMsg = `[Auth] Secret loaded: ${!!secret}, Prefix: ${secret ? secret.substring(0, 5) + "..." : "UNDEFINED"}`;
console.log(logMsg);
logToFile(logMsg);

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "mongodb",
    }),

    // Email + Password Authentication
    emailAndPassword: {
        enabled: true,
    },

    // JWT Configuration
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds (604800)
        updateAge: 60 * 60 * 24, // Update session every 24 hours
    },

    // Organizations/Teams Plugin (Multi-tenancy)
    // JWT Plugin (for JWT token generation)
    plugins: [
        organization({
            allowUserToCreateOrganization: true,
            defaultOrganizationName: "Personal",
        }),
        jwt(), // Enable JWT token generation
    ],

    // ⚠️ CRITICAL FIX: Trusted Origins for CORS
    trustedOrigins: [
        "https://parsify-frontend.vercel.app",
        "https://parsify-frontend.vercel.app/",
        "http://localhost:3000",
        "http://localhost:3001",
        ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
    ],

    // Secret Key
    secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,

    // Base URL
    baseURL: process.env.BACKEND_URL || "https://parsify-backend.onrender.com",

    // Base Path
    basePath: "/api/auth",
});

// Export types
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;