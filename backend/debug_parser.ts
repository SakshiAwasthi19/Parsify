import { parseTransaction } from './src/lib/parser.js';

const sample1 = `Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50`;

const sample2 = `Uber Ride * Airport Drop
12/11/2025 -> ₹1,250.00 debited
Available Balance -> ₹17,170.50`;

const sample3 = `txn123 2025-12-10 Amazon.in Order #403-1234567-8901234 ₹2,999.00 Dr Bal 14171.50 Shopping`;

console.log('--- Sample 1 ---');
const r1 = parseTransaction(sample1);
console.log('Date:', r1.date.toISOString(), 'Raw:', r1.date.toString());
console.log('Desc:', r1.description);
console.log('Amt:', r1.amount);
console.log('Bal:', r1.balance);

console.log('\n--- Sample 2 ---');
const r2 = parseTransaction(sample2);
console.log('Date:', r2.date.toISOString(), 'Raw:', r2.date.toString());
console.log('Desc:', r2.description);
console.log('Amt:', r2.amount);
console.log('Bal:', r2.balance);

console.log('\n--- Sample 3 ---');
const r3 = parseTransaction(sample3);
console.log('Date:', r3.date.toISOString(), 'Raw:', r3.date.toString());
console.log('Desc:', r3.description);
console.log('Amt:', r3.amount);
console.log('Bal:', r3.balance);
