
import { parseTransaction } from '../src/lib/parser';

describe('Transaction Parser', () => {
    // Sample 1: Clean format with labels
    const sample1 = `Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50`;

    const sample1SingleLine = `Date: 11 Dec 2025 Description: STARBUCKS COFFEE MUMBAI Amount: -420.00 Balance after transaction: 18,420.50`;

    // Sample 2: Inline format with arrows
    const sample2 = `Uber Ride * Airport Drop
12/11/2025 → ₹1,250.00 debited
Available Balance → ₹17,170.50`;

    // Sample 3: Compact format
    const sample3 = `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`;

    // Expected values for assertions (using getTime() for robustness)
    const expectedDateSample1 = new Date(Date.UTC(2025, 11, 11)).getTime(); // 11 Dec 2025
    const expectedDateSample2 = new Date(Date.UTC(2025, 10, 12)).getTime(); // 12 Nov 2025 (DD/MM)
    const expectedDateSample3 = new Date(Date.UTC(2025, 11, 10)).getTime(); // 2025-12-10

    test('Parser handles Sample 1 format correctly (Multi-line)', () => {
        const result = parseTransaction(sample1);

        expect(result.date.getTime()).toEqual(expectedDateSample1);
        expect(result.description).toBe('STARBUCKS COFFEE MUMBAI');
        expect(result.amount).toBe(-420.00);
        expect(result.balance).toBe(18420.50);
    });

    test('Parser handles Sample 1 format correctly (Single-line)', () => {
        const result = parseTransaction(sample1SingleLine);

        expect(result.date.getTime()).toEqual(expectedDateSample1);
        expect(result.description).toBe('STARBUCKS COFFEE MUMBAI');
        expect(result.amount).toBe(-420.00);
        expect(result.balance).toBe(18420.50);
    });

    test('Parser handles Sample 2 format correctly', () => {
        const result = parseTransaction(sample2);

        expect(result.date.getTime()).toEqual(expectedDateSample2);
        expect(result.description).toBe('Uber Ride * Airport Drop');
        expect(result.amount).toBe(-1250.00); // Debited means negative
        expect(result.balance).toBe(17170.50);
    });

    test('Parser handles Sample 3 format correctly', () => {
        const result = parseTransaction(sample3);

        expect(result.date.getTime()).toEqual(expectedDateSample3);
        // Universal parser extracts core merchant name
        expect(result.description).toContain('Amazon');
        expect(result.amount).toBeCloseTo(-2999.00);
        expect(result.balance).toBeCloseTo(14171.50);
    });

    test("throws error when amount is missing (order ID false positive)", () => {
        const noAmount = "Amazon.in: Order #171-1234567-8901234 - Wireless Mouse on 10-Dec-2025 Avl Bal 14,171.50";

        expect(() => {
            parseTransaction(noAmount);
        }).toThrow('Please include amount in your transaction text.');
    });

    test("extracts amount correctly even with order ID present", () => {
        const withAmount = "Amazon.in: Order #171-1234567-8901234 ₹2,999.00 on 10-Dec-2025 Avl Bal 14,171.50";
        const result = parseTransaction(withAmount);

        expect(result.amount).toBeCloseTo(-2999);
        expect(result.balance).toBeCloseTo(14171.5);
        // Should NOT extract 1234567 as amount!
    });
});
