"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(false);
  }, [router]);

  const handleLogout = async () => {
    try {
      // Call logout API
      await authApi.logout();
    } catch (err) {
      // Even if logout API fails, clear token locally
      console.error("Logout API error:", err);
    } finally {
      // Clear token from localStorage
      clearToken();
      // Redirect to login
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Parsify</CardTitle>
            <CardDescription>Your personal finance transaction extractor</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              You are successfully logged in! This is your dashboard.
            </p>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
              Transaction extraction features will be available here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
