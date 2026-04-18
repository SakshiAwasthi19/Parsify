"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { transactionApi, authApi } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: string;
  balance: string;
  createdAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [transactionText, setTransactionText] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }
    // Fetch initial transactions
    fetchTransactions();
  }, [router]);

  const fetchTransactions = async (cursor?: string) => {
    try {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");

      const res = await transactionApi.getAll(cursor, 10);
      const newTransactions = res.transactions || [];

      if (cursor) {
        // Append to existing transactions
        setTransactions((prev) => [...prev, ...newTransactions]);
      } else {
        // Replace transactions
        setTransactions(newTransactions);
      }

      setNextCursor(res.nextCursor || null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialLoad(false);
    }
  };

  const handleExtract = async () => {
    if (!transactionText.trim()) {
      setError("Please enter transaction text");
      return;
    }

    setParsing(true);
    setError("");
    setSuccess("");

    try {
      const res = await transactionApi.extract(transactionText);
      
      // Add the new transaction to the top of the list
      if (res.transaction) {
        setTransactions((prev) => [res.transaction, ...prev]);
        setSuccess("Transaction extracted and saved successfully!");
        setTransactionText(""); // Clear textarea
      }
    } catch (err: any) {
      setError(err.message || "Failed to extract transaction");
    } finally {
      setParsing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error("Logout API error:", err);
    } finally {
      clearToken();
      router.push("/login");
    }
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchTransactions(nextCursor);
    }
  };

  // Format currency
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(num);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (initialLoad) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-50">
              Parsify Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Extract and manage your financial transactions
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        {/* Extract Transaction Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Extract Transaction</CardTitle>
            <CardDescription>
              Paste your bank statement text below to extract transaction details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full min-h-[120px] rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Paste transaction text here...&#10;&#10;Example:&#10;Date: 11 Dec 2025&#10;Description: STARBUCKS COFFEE MUMBAI&#10;Amount: -420.00&#10;Balance after transaction: 18,420.50"
              value={transactionText}
              onChange={(e) => setTransactionText(e.target.value)}
              disabled={parsing}
            />

            <Button
              onClick={handleExtract}
              disabled={parsing || !transactionText.trim()}
              className="w-full"
            >
              {parsing ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Parsing & Saving...
                </span>
              ) : (
                "Parse & Save"
              )}
            </Button>

            {/* Success Message */}
            {success && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transactions Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              Your extracted financial transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-600 dark:text-gray-400">Loading transactions...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400">
                    No transactions found.
                  </p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                    Extract your first transaction above to get started.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium">
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                parseFloat(transaction.amount) < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-green-600 dark:text-green-400"
                              }
                            >
                              {formatCurrency(transaction.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(transaction.balance)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(transaction.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Load More Button */}
                {nextCursor && (
                  <div className="mt-4 flex justify-center">
                    <Button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      variant="outline"
                    >
                      {loadingMore ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        "Load More"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
