// ============================================
// TRANSACTION PARSER TESTS
// Test all 3 formats
// ============================================

import { parseTransaction } from "./parser";

describe("parseTransaction - Universal Formats", () => {
  // Original 3 samples (should still work)
  const sample1 = `Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50`;

  const sample2 = `Uber Ride * Airport Drop
12/11/2025 → ₹1,250.00 debited
Available Balance → ₹17,170.50`;

  const sample3 = `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`;

  test("parses sample 1 (backward compatibility)", () => {
    const result = parseTransaction(sample1);
    expect(result.description).toContain("STARBUCKS");
    expect(result.amount).toBeCloseTo(-420);
    expect(result.balance).toBeCloseTo(18420.5);
  });

  test("parses sample 2 (backward compatibility)", () => {
    const result = parseTransaction(sample2);
    expect(result.description).toBeTruthy();
    expect(result.amount).toBeCloseTo(-1250);
    expect(result.balance).toBeCloseTo(17170.5);
  });

  test("parses sample 3 (backward compatibility)", () => {
    const result = parseTransaction(sample3);
    // Universal parser extracts core merchant name, not full order details
    expect(result.description).toContain('Amazon');
    expect(result.amount).toBeCloseTo(-2999);
    expect(result.balance).toBeCloseTo(14171.5);
  });

  // NEW: Universal format tests
  test("parses UPI format", () => {
    const upi = "You sent ₹500 to John@paytm on 28-Feb-2026 3:45 PM. Avl Bal: ₹12,340";
    const result = parseTransaction(upi);
    expect(result.amount).toBeCloseTo(-500);
    expect(result.balance).toBeCloseTo(12340);
    expect(result.date).toBeDefined();
  });

  test("parses credit card format", () => {
    const cc = "HDFC CC: SWIGGY BANGALORE 27/02/26 Rs.850.00 debited Avl Limit 45000";
    const result = parseTransaction(cc);
    expect(result.amount).toBeCloseTo(-850);
    expect(result.balance).toBeCloseTo(45000);
  });

  test("parses salary credit", () => {
    const salary = "Salary credited Rs 50,000.00 on 01/03/2026 Balance: 67,500.00";
    const result = parseTransaction(salary);
    expect(result.amount).toBeCloseTo(50000); // Positive (credit)
    expect(result.balance).toBeCloseTo(67500);
  });

  test("parses ATM withdrawal", () => {
    // Add currency symbol to avoid ambiguity with year
    const atm = "ATM Withdrawal ₹2000 on 28-FEB-2026 Remaining Bal ₹15500";
    const result = parseTransaction(atm);
    expect(result.amount).toBeCloseTo(-2000);
    expect(result.balance).toBeCloseTo(15500);
    expect(result.date).toBeDefined();
  });

  test("parses USD transaction", () => {
    const usd = "Netflix Subscription $15.99 debited 2026-02-28 Bal: $234.56";
    const result = parseTransaction(usd);
    expect(result.amount).toBeCloseTo(-15.99);
    expect(result.balance).toBeCloseTo(234.56);
  });
});
