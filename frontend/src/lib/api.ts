const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

import { getToken } from "./auth";

/**
 * Generic API helper
 * - Always attaches JWT token if available
 * - Safely handles empty responses
 * - Provides clear error logging
 */
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  // Build headers - conditionally include Content-Type and Authorization
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Only add Content-Type: application/json if method is not GET/HEAD
  const method = options.method ? options.method.toUpperCase() : "GET";
  if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Always attach Authorization header if token exists IN STORAGE
  // BUT don't overwrite if one was manually provided in options.headers
  if (token && !headers["Authorization"]) {
    headers.Authorization = `Bearer ${token}`;
    // Debug log (remove in production)
    console.log("🔑 Sending request with stored token:", {
      path,
      tokenLength: token.length,
    });
  } else if (!headers["Authorization"]) {
    // Only warn if absolutely no token is available from either storage or manual options
    console.warn("⚠️ No token available for request:", path);
  } else if (headers["Authorization"]) {
    console.log("🔑 Sending request with manual token for path:", path);
  }

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
      credentials: "include", // Include cookies in requests
    });

    // Check if response has content before parsing
    const contentType = res.headers.get("content-type");
    const hasJsonContent = contentType && contentType.includes("application/json");

    // Check for Set-Cookie header (Better Auth might set token in cookie)
    const setCookieHeader = res.headers.get("set-cookie");
    if (setCookieHeader) {
      console.log("🍪 Set-Cookie header received:", setCookieHeader);
    }

    let data: any = null;

    if (hasJsonContent) {
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("API: Failed to parse JSON response:", parseError);
          throw new Error("Invalid JSON response from server");
        }
      }
    } else {
      // Handle non-JSON responses (e.g., empty body)
      const text = await res.text();
      if (text) {
        data = text;
      }
    }

    if (!res.ok) {
      const errorMessage = data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`;
      console.error("API Error:", {
        path,
        status: res.status,
        statusText: res.statusText,
        error: errorMessage,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + "..." : null,
        responseData: data,
      });

      // If 401 and we have a token, it might be expired or invalid
      if (res.status === 401 && token) {
        console.error("🔴 401 Unauthorized with token present - token may be expired or invalid");

        // Auto-logout if token is definitively expired
        if (data?.code === "TOKEN_EXPIRED") {
          console.warn("🔒 Token is expired, clearing storage and redirecting...");
          // Only clear if we are in the browser
          if (typeof window !== "undefined") {
            const { clearToken } = await import("./auth");
            clearToken();
            window.location.href = "/login";
          }
        }
      }

      throw new Error(errorMessage);
    }

    return data;
  } catch (error: any) {
    // Re-throw if it's already our Error with message
    if (error instanceof Error) {
      throw error;
    }
    // Handle network errors
    console.error("API Network Error:", {
      path,
      error: error.message || "Network request failed",
      hasToken: !!token,
    });
    throw new Error(error.message || "Network request failed");
  }
}

/* ================= AUTH API ================= */

export const authApi = {
  async register(email: string, password: string, name?: string) {
    return apiFetch("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string) {
    return apiFetch("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async getSession() {
    // Get current session (may include token)
    return apiFetch("/api/auth/session", {
      method: "GET",
    });
  },

  async logout() {
    // Backend may return empty body - apiFetch handles it safely
    return apiFetch("/api/auth/sign-out", {
      method: "POST",
    });
  },
};

/* ================= TRANSACTION API ================= */

export const transactionApi = {
  async extract(text: string) {
    return apiFetch("/api/transactions/extract", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  async getAll(cursor?: string, limit: number = 10) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    params.set("limit", String(limit));

    return apiFetch(`/api/transactions?${params.toString()}`);
  },
};
