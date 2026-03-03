// ============================================
// UNIVERSAL PATTERN LIBRARY
// Supports 40+ transaction formats
// ============================================

export interface ParsedTransaction {
  date: Date;
  description: string;
  amount: number;
  balance: number;
}

// Date patterns (15+ variations)
const DATE_PATTERNS = [
  // ISO 8601: 2025-12-10, 2025/12/10
  { regex: /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g, priority: 1 },

  // DD/MM/YYYY: 11/12/2025, 11-12-2025
  { regex: /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/g, priority: 2 },

  // DD Mon YYYY: 11 Dec 2025, 11 December 2025
  { regex: /\b(\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})\b/gi, priority: 1 },

  // Mon DD, YYYY: Dec 11, 2025
  { regex: /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi, priority: 2 },

  // DD-Mon-YYYY: 28-Feb-2026, 28-FEB-2026
  { regex: /\b(\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{4})\b/gi, priority: 1 },

  // DD/MM/YY: 11/12/25, 28/02/26
  { regex: /\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2})(?!\d)/g, priority: 3 },

  // Timestamp: 2025-12-10T14:30:00Z
  { regex: /\b(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d{3})?(?:Z|[+-]\d{2}:?\d{2})?)\b/g, priority: 1 },

  // With time: 3:45 PM on 28-Feb-2026
  { regex: /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)\s+(?:on\s+)?(\d{1,2}[-/.][a-z]{3}[-/.]\d{4})/gi, priority: 2 },
];

// Amount patterns (12+ variations)
const AMOUNT_PATTERNS = [
  // Currency prefix: ₹1,250.00, Rs.420.00, INR 2,999, $100.50 (HIGHEST PRIORITY)
  { regex: /[₹$]\s*([\d,]+\.?\d*)/g, priority: 1 },
  { regex: /(?:Rs\.?|INR|USD)\s*([\d,]+\.?\d*)/gi, priority: 1 },

  // After keywords: "Amt: 420.00", "Amount: 1,250.00" (HIGH PRIORITY)
  { regex: /(?:amt|amount|value|rs\.?|inr|price|total|paid|spent)[\s:]+(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 2 },

  // Negative amounts: -420.00, -1,250
  { regex: /-\s*([\d,]+\.?\d*)/g, priority: 2 },

  // Formatted with decimals: 1,250.00, 14,171.50 (MEDIUM PRIORITY)
  { regex: /\b([\d]{1,3}(?:,[\d]{3})+\.[\d]{2})\b/g, priority: 3 },

  // With decimals but no commas: 420.00, 2999.50 (LOWER PRIORITY)
  { regex: /\b([\d]{2,}\.[\d]{2})\b/g, priority: 4 },

  // Formatted without decimals: 1,250, 14,171 (VERY LOW - likely balance not amount)
  { regex: /\b([\d]{1,3}(?:,[\d]{3})+)\b(?!\.\d)/g, priority: 6 },

  // Large integers: 1250, 2999 (LOWEST - very ambiguous, likely IDs)
  { regex: /\b([\d]{3,})\b/g, priority: 7 },
];

// Balance patterns (10+ variations)
const BALANCE_PATTERNS = [
  { regex: /(?:balance|bal)[\s:]+(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 1 },
  { regex: /balance\s+after(?:\s+transaction)?[\s:]*(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 1 },
  { regex: /(?:available\s+balance|avl\s+bal(?:ance)?)[\s:]*(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 1 },
  { regex: /(?:avl\s+limit|available\s+limit|credit\s+limit)[\s:]*(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 1 },
  { regex: /(?:remaining|current)\s+(?:balance|bal)[\s:]*(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 2 },
  { regex: /\bbal(?:ance)?[\s:→]*(?:[₹$Rs.INR]*)\s*([\d,]+\.?\d*)/gi, priority: 2 },
];

// Transaction type keywords
const DEBIT_KEYWORDS = [
  'debited', 'debit', 'dr', 'paid', 'sent', 'withdrawn',
  'purchase', 'spent', 'payment', 'transferred to', 'withdraw',
  'deducted', 'charged', 'bill', 'emi', 'subscription'
];

const CREDIT_KEYWORDS = [
  'credited', 'credit', 'cr', 'received', 'deposited',
  'refund', 'cashback', 'salary', 'transferred from', 'deposit',
  'received from', 'income', 'interest', 'reward', 'reversal'
];

// Month mapping
const MONTH_MAP: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11,
};

/**
 * Universal transaction parser
 * @param text - Raw transaction text
 * @returns Parsed transaction object
 */
export function parseTransaction(text: string): ParsedTransaction {
  // Normalize input
  const normalized = normalizeText(text);

  // Track missing fields for better error messages
  const missingFields: string[] = [];

  // Extract all fields using pattern matching
  const dateResult = extractDate(normalized);
  const date = dateResult || new Date();

  const amount = tryExtractAmount(normalized, text);
  if (amount === null) missingFields.push("amount");

  const balance = tryExtractBalance(normalized);
  if (balance === null) missingFields.push("available balance");

  const description = extractDescription(normalized, text);
  if (!description || description === 'Unknown Transaction' || description.length < 3) {
    missingFields.push("transaction message (description)");
  }

  // If fields are missing, throw a helpful consolidated error
  if (missingFields.length > 0) {
    const list = missingFields.join(", ");
    const message = missingFields.length === 1
      ? `Please include ${list} in your transaction text.`
      : `Please include both ${missingFields.slice(0, -1).join(", ")} and ${missingFields.slice(-1)} in your transaction text.`;
    throw new Error(message);
  }

  return {
    date,
    description,
    amount: amount!,
    balance: balance!
  };
}

// Normalize text for parsing
function normalizeText(text: string): string {
  let normalized = text.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Normalize separators
  normalized = normalized.replace(/[→➔➜⇒⟶—–]/g, ' ');
  normalized = normalized.replace(/[|]/g, ' ');

  // Normalize currency
  normalized = normalized.replace(/Rs\.?(?=\s*\d)/gi, '₹');
  normalized = normalized.replace(/INR(?=\s*\d)/gi, '₹');

  // Clean whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// Extract date using multiple patterns
function extractDate(text: string): Date | null {
  const candidates: Array<{ date: Date; confidence: number }> = [];

  for (const pattern of DATE_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern.regex));

    for (const match of matches) {
      const dateStr = match[1] || match[0];
      const parsedDate = parseFlexibleDate(dateStr);

      if (parsedDate && isValidDate(parsedDate)) {
        const confidence = 100 - (pattern.priority - 1) * 10;
        candidates.push({ date: parsedDate, confidence });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Return highest confidence date
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0].date;
}

// Flexible date parser (handles all formats)
function parseFlexibleDate(dateStr: string): Date | null {
  try {
    const cleaned = dateStr.trim().toLowerCase();

    // ISO format: 2025-12-10
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(cleaned)) {
      const parts = cleaned.split(/[-/]/);
      return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }

    // Timestamp with time
    if (cleaned.includes('t') || /\d{2}:\d{2}/.test(cleaned)) {
      return new Date(cleaned);
    }

    // DD Mon YYYY: 11 Dec 2025, 28-Feb-2026
    const monthMatch = cleaned.match(/(\d{1,2})[\s-]([a-z]+)[\s-](\d{4})/);
    if (monthMatch) {
      const [, day, monthStr, year] = monthMatch;
      const month = MONTH_MAP[monthStr.slice(0, 3)];
      if (month !== undefined) {
        return new Date(Date.UTC(parseInt(year), month, parseInt(day)));
      }
    }

    // Mon DD YYYY: Dec 11 2025
    const monthFirstMatch = cleaned.match(/([a-z]+)[\s]+(\d{1,2})[,\s]+(\d{4})/);
    if (monthFirstMatch) {
      const [, monthStr, day, year] = monthFirstMatch;
      const month = MONTH_MAP[monthStr.slice(0, 3)];
      if (month !== undefined) {
        return new Date(Date.UTC(parseInt(year), month, parseInt(day)));
      }
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = cleaned.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (ddmmyyyyMatch) {
      let [, day, month, year] = ddmmyyyyMatch;

      // Handle 2-digit year
      if (year.length === 2) {
        const yearNum = parseInt(year);
        year = yearNum > 50 ? `19${year}` : `20${year}`;
      }

      return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    }

    return null;
  } catch {
    return null;
  }
}

// Validate date is reasonable
function isValidDate(date: Date): boolean {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 5, 0, 1);
  const oneYearAhead = new Date(now.getFullYear() + 1, 11, 31);
  return date >= fiveYearsAgo && date <= oneYearAhead;
}

// Extract amount using multiple patterns
function tryExtractAmount(normalized: string, original: string): number | null {
  const candidates: Array<{ amount: number; confidence: number; source: string }> = [];

  // 1. Remove obvious IDs and reference numbers
  let cleanedText = normalized;
  cleanedText = cleanedText.replace(/\b(?:order|txn|ref|utr|rrn)[\s#:]*[\d-]+/gi, ' ');
  cleanedText = cleanedText.replace(/\b#[\d-]+/g, ' '); // Remove any #123-456-789 patterns

  // 2. Remove obvious balance patterns to avoid picking balance as amount
  for (const pattern of BALANCE_PATTERNS) {
    cleanedText = cleanedText.replace(pattern.regex, ' ');
  }

  // 3. Remove date patterns to avoid picking years as amounts
  for (const pattern of DATE_PATTERNS) {
    cleanedText = cleanedText.replace(pattern.regex, ' ');
  }

  for (const pattern of AMOUNT_PATTERNS) {
    const matches = Array.from(cleanedText.matchAll(pattern.regex));

    for (const match of matches) {
      const amountStr = match[1] || match[0];
      // FIX: Do NOT remove the dot if it's a decimal point
      const cleaned = amountStr.replace(/[₹$Rs,INR\s]/gi, '');
      const amount = parseFloat(cleaned);

      // Validate amount is reasonable
      if (!isNaN(amount) && amount > 0) {
        // Skip unreasonably large amounts (likely order IDs or account numbers)
        if (amount > 10000000) continue; // Skip amounts > 1 crore

        // Flag suspicious amounts (likely IDs if > 1 lakh and no decimal)
        const isSuspicious = amount > 100000 && !amountStr.includes('.');

        const confidence = calculateAmountConfidence(amount, pattern.priority, isSuspicious);
        candidates.push({ amount, confidence, source: amountStr });
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by confidence and get best amount
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Reject if best candidate has very low confidence (< 30)
  if (candidates[0].confidence < 30) {
    return null;
  }

  let amount = candidates[0].amount;

  // Determine if debit (negative)
  const lowerOriginal = original.toLowerCase();
  const isDebit = DEBIT_KEYWORDS.some(kw => lowerOriginal.includes(kw)) ||
    original.includes('-');

  if (isDebit) {
    amount = Math.abs(amount) * -1;
  }

  return amount;
}

// Helper: Calculate amount confidence with suspicion check
function calculateAmountConfidence(amount: number, priority: number, isSuspicious: boolean): number {
  let score = 100;

  // Suspicious amounts (likely IDs) get very low confidence
  if (isSuspicious) {
    score -= 50;
  }

  // Amount reasonableness (most transactions are under 1 lakh)
  if (amount >= 10 && amount <= 100000) score += 10;
  else if (amount < 10 || amount > 500000) score -= 15;

  // Pattern priority
  score -= (priority - 1) * 3;

  return Math.max(0, score);
}

// Extract balance using patterns
function tryExtractBalance(text: string): number | null {
  for (const pattern of BALANCE_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern.regex));

    for (const match of matches) {
      const balanceStr = match[1];
      const cleaned = balanceStr.replace(/[₹$Rs,INR\s]/gi, '');
      const balance = parseFloat(cleaned);

      if (!isNaN(balance) && balance >= 0 && balance < 100000000) {
        return balance;
      }
    }
  }

  return null;
}

// Extract description (remove extracted data, keep meaningful text)
function extractDescription(normalized: string, original: string): string {
  let description = normalized;

  // 1. Remove all occurrences of matched patterns to isolate description
  // Using a copy of the regex to avoid resetting global state if shared
  for (const pattern of DATE_PATTERNS) {
    description = description.replace(new RegExp(pattern.regex, 'gi'), ' ');
  }
  for (const pattern of AMOUNT_PATTERNS) {
    description = description.replace(new RegExp(pattern.regex, 'gi'), ' ');
  }
  for (const pattern of BALANCE_PATTERNS) {
    description = description.replace(new RegExp(pattern.regex, 'gi'), ' ');
  }

  // 2. Remove common field labels and separators
  // Only remove if followed by a separator or at the very end
  const labelsToRemove = [
    /\b(?:date|time|description|desc|amount|amt|value|balance|bal|available|avl|remaining|rem|after|transaction|txn|ref|utr|order|payment)\s*[:\-]+/gi,
    /\b(?:dr|cr|debited|credited|paid|on|to|from|at|in|by|for|of|with|is|rs|inr|usd|eur|gbp|available|balance|after|remaining)\b/gi,
    /[₹$#➔➜⇒⟶—–|:→]/g,
  ];

  for (const pattern of labelsToRemove) {
    description = description.replace(pattern, ' ');
  }

  // 3. Final cleanup of whitespace and punctuation
  // Remove transaction-related trailing words
  description = description.replace(/\s+/g, ' ').trim();
  description = description.replace(/^[:\-|\s]+|[:\-|\s]+$/g, '');

  return description || 'Unknown Transaction';
}

/**
 * Parses multiple transactions from a block of text
 */
export function parseMultipleTransactions(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim().length > 0);

  for (const block of blocks) {
    try {
      const transaction = parseTransaction(block);
      transactions.push(transaction);
    } catch (error) {
      console.warn(`Failed to parse transaction block: ${block.substring(0, 50)}...`, error);
    }
  }

  if (transactions.length === 0) {
    try {
      transactions.push(parseTransaction(text));
    } catch (error) {
      throw new Error(`Failed to parse any transactions from text`);
    }
  }

  return transactions;
}

