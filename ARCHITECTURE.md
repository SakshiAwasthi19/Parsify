# Architecture & Design Document
## Parsify: Personal Finance Transaction Extractor

---

## 1. OVERALL ARCHITECTURE EXPLANATION

### 1.1 Data Flow: User → Frontend → Backend → Database

Think of this like ordering food at a restaurant:

```
User (Customer)
  ↓ Types bank statement text
Frontend (Waiter)
  ↓ Sends request with authentication token
Backend API (Kitchen)
  ↓ Validates user, parses text, queries database
Database (Pantry)
  ↓ Returns only user's own data
Backend API
  ↓ Formats response
Frontend
  ↓ Displays transactions in table
User
```

**Step-by-Step Flow:**

1. **User Registration/Login:**
   - User enters email + password on frontend
   - Frontend sends to `POST /api/auth/register` or `POST /api/auth/login`
   - Backend uses Better Auth to hash password (never store plain text!)
   - Better Auth creates a JWT token (like a temporary ID card, valid for 7 days)
   - Backend returns JWT token to frontend
   - Frontend stores token (in memory/cookies, NOT localStorage)

2. **Making Authenticated Requests:**
   - User pastes bank statement text in textarea
   - User clicks "Extract Transactions"
   - Frontend sends `POST /api/transactions/extract` with:
     - JWT token in `Authorization: Bearer <token>` header
     - The raw text in request body
   - Backend middleware checks JWT is valid (not expired, not tampered)
   - Backend extracts `userId` and `organizationId` from JWT
   - Backend parses the text using regex/pattern matching
   - Backend saves transactions to database WITH `userId` and `organizationId`
   - Backend returns success response

3. **Viewing Transactions:**
   - User navigates to dashboard (already has JWT from login)
   - Frontend sends `GET /api/transactions?cursor=...` with JWT token
   - Backend validates JWT, extracts `userId` and `organizationId`
   - Backend queries database: `SELECT * FROM transactions WHERE userId = ? AND organizationId = ?`
   - **CRITICAL:** Backend NEVER trusts the frontend - it always filters by the userId from the JWT
   - Backend returns paginated results
   - Frontend displays in table

### 1.2 Better Auth + Auth.js Integration

**Better Auth (Backend):**
- Handles all the "hard" security stuff:
  - Password hashing (bcrypt/argon2 - one-way encryption)
  - JWT creation and signing (prevents tampering)
  - Session management
  - Organization/team management (multi-tenancy)

**Auth.js (Frontend):**
- Syncs with Better Auth backend
- Provides React hooks: `useSession()`, `signIn()`, `signOut()`
- Automatically includes JWT in API requests
- Handles token refresh

**How They Work Together:**
```
Frontend (Auth.js)          Backend (Better Auth)
     |                              |
     |--- POST /api/auth/login ---->|
     |                              | Hash password
     |                              | Create JWT
     |<--- Returns JWT token -------|
     |                              |
     | Stores JWT in memory/cookie  |
     |                              |
     |--- GET /api/transactions ---->|
     | (includes JWT in header)        |
     |                              | Verify JWT
     |                              | Extract userId
     |                              | Query DB with userId
     |<--- Returns user's data ------|
```

**Why JWT?**
- Stateless: Backend doesn't need to store sessions in memory
- Scalable: Can add more backend servers without sharing session storage
- Secure: Signed with secret key, can't be tampered with
- Contains user info: userId, organizationId, email (no need to query DB for every request)

### 1.3 Multi-Tenancy Explained

**What is Multi-Tenancy?**
Imagine an apartment building:
- Each apartment (organization) is separate
- Each person (user) can belong to multiple apartments
- You can only access your own apartment's data

**In Our App:**
- A user can belong to multiple organizations (e.g., "Personal", "Family Budget", "Business")
- Each transaction belongs to ONE organization
- When a user creates a transaction, it's tagged with their current organization
- When querying, we filter by BOTH userId AND organizationId

**Why Multi-Tenancy?**
- A user might want separate budgets (personal vs business)
- Teams can share an organization (family members, business partners)
- Better data organization

**How We Implement It:**
1. User registers → Better Auth creates user
2. User creates/joins organization → Entry in `memberships` table
3. When user creates transaction → We use their current `organizationId`
4. Every query filters by `userId` AND `organizationId`

### 1.4 Data Isolation at Database Level

**The Golden Rule:** Never trust the frontend. Always filter by userId from the JWT.

**How It Works:**

**❌ WRONG (Dangerous):**
```typescript
// Frontend sends: GET /api/transactions?userId=123
// Backend does:
const transactions = await db.transaction.findMany({
  where: { userId: req.query.userId } // DANGER! User could change this!
});
```

**✅ CORRECT (Secure):**
```typescript
// Frontend sends: GET /api/transactions (with JWT in header)
// Backend does:
const userId = req.user.id; // Extracted from JWT, can't be faked
const orgId = req.user.organizationId; // From JWT

const transactions = await db.transaction.findMany({
  where: { 
    userId: userId,        // From JWT, not from request
    organizationId: orgId  // From JWT, not from request
  }
});
```

**Database-Level Protection:**
1. **Indexes:** Fast lookups by userId + organizationId
2. **Constraints:** Foreign keys ensure data integrity
3. **Row-Level Security (if using PostgreSQL RLS):** Extra layer (optional)

**What Happens If User Tries to Hack?**
- User modifies request: `GET /api/transactions?userId=999` (another user's ID)
- Backend ignores this and uses userId from JWT
- User can only see their own data

---

## 2. PRISMA SCHEMA DESIGN

### 2.1 Complete Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

// ============================================
// BETTER AUTH TABLES (Required by Better Auth)
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  memberships   Membership[]
  transactions  Transaction[]

  @@index([email])
  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([sessionToken])
  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ============================================
// MULTI-TENANCY TABLES
// ============================================

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique // URL-friendly name
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  memberships   Membership[]
  transactions  Transaction[]

  @@index([slug])
  @@map("organizations")
}

model Membership {
  id             String   @id @default(cuid())
  userId         String
  organizationId String
  role           String   @default("member") // "owner", "admin", "member"
  createdAt      DateTime @default(now())

  // Relations
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId]) // User can only have one membership per org
  @@index([userId])
  @@index([organizationId])
  @@map("memberships")
}

// ============================================
// TRANSACTION TABLE (Core Business Logic)
// ============================================

model Transaction {
  id             String   @id @default(cuid())
  userId         String   // Who created it
  organizationId String   // Which org it belongs to
  date           DateTime // Parsed transaction date
  description    String   // Parsed description
  amount         Float   // Can be negative (debit) or positive (credit)
  balance        Float   // Balance after transaction
  rawText        String? // Original text (for debugging)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // Relations
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // CRITICAL INDEXES for performance and data isolation
  @@index([userId, organizationId, createdAt(sort: Desc)]) // For cursor pagination
  @@index([userId]) // Fast user lookups
  @@index([organizationId]) // Fast org lookups
  @@index([createdAt(sort: Desc)]) // For sorting
  @@map("transactions")
}
```

### 2.2 Schema Explanation

**Better Auth Tables:**
- `User`: Core user info (Better Auth compatible)
- `Account`: OAuth providers (Google, GitHub, etc.) - optional for now
- `Session`: Active sessions (Better Auth manages this)
- `VerificationToken`: Email verification tokens

**Multi-Tenancy Tables:**
- `Organization`: Represents a "workspace" (e.g., "Personal Budget", "Family")
- `Membership`: Links users to organizations (many-to-many with role)

**Transaction Table:**
- `userId`: Who created it (for data isolation)
- `organizationId`: Which org it belongs to (for multi-tenancy)
- `date`, `description`, `amount`, `balance`: Parsed fields
- `rawText`: Original text (useful for debugging parsing issues)

### 2.3 Why These Indexes?

**Index: `[userId, organizationId, createdAt(sort: Desc)]`**
- Used for cursor pagination queries
- Composite index = super fast when filtering by userId + orgId + sorting by date
- Example query: `WHERE userId = ? AND organizationId = ? ORDER BY createdAt DESC LIMIT 20`

**Index: `[userId]`**
- Fast lookups for "all transactions by user"
- Used in authorization checks

**Index: `[organizationId]`**
- Fast lookups for "all transactions in organization"
- Useful for org-level analytics (future feature)

**Index: `[createdAt(sort: Desc)]`**
- Fast sorting when not filtering by user/org
- Used in admin queries (if you add admin role later)

### 2.4 Data Types Explained

- `String @id @default(cuid())`: Unique ID (better than auto-increment for security)
- `Float`: Money (Standard for MongoDB Prisma integration)
- `DateTime`: MongoDB timestamp
- `String?`: Optional text field (for rawText)
- `@unique`: Database-level uniqueness constraint
- `onDelete: Cascade`: If user is deleted, delete their transactions too

---

## 3. POTENTIAL SECURITY PITFALLS

### 3.1 Data Isolation Mistakes

**❌ MISTAKE #1: Trusting Request Parameters**
```typescript
// DANGEROUS!
app.get('/api/transactions', async (req) => {
  const userId = req.query.userId; // User can modify this!
  const transactions = await db.transaction.findMany({
    where: { userId }
  });
});
```
**Fix:** Always use userId from JWT token.

**❌ MISTAKE #2: Not Filtering by Organization**
```typescript
// DANGEROUS if user belongs to multiple orgs!
app.get('/api/transactions', async (req) => {
  const userId = req.user.id;
  const transactions = await db.transaction.findMany({
    where: { userId } // Missing organizationId!
  });
});
```
**Fix:** Always filter by BOTH userId AND organizationId.

**❌ MISTAKE #3: Using Frontend-Sent IDs in Updates**
```typescript
// DANGEROUS!
app.put('/api/transactions/:id', async (req) => {
  const transaction = await db.transaction.update({
    where: { id: req.params.id }, // User could change this!
    data: { description: req.body.description }
  });
});
```
**Fix:** Verify ownership first:
```typescript
const transaction = await db.transaction.findFirst({
  where: { 
    id: req.params.id,
    userId: req.user.id,      // Verify ownership
    organizationId: req.user.organizationId
  }
});
if (!transaction) throw new Error('Not found');
```

### 3.2 Authentication Mistakes

**❌ MISTAKE #4: Storing JWT in localStorage**
```typescript
// DANGEROUS - vulnerable to XSS attacks!
localStorage.setItem('token', jwt);
```
**Fix:** Use httpOnly cookies or in-memory storage (Auth.js handles this).

**❌ MISTAKE #5: Not Validating JWT on Every Request**
```typescript
// DANGEROUS - skipping validation!
app.get('/api/transactions', async (req) => {
  // No JWT check!
  const transactions = await db.transaction.findMany();
});
```
**Fix:** Use middleware to validate JWT on every protected route.

**❌ MISTAKE #6: Weak Password Requirements**
```typescript
// DANGEROUS - allows "123" as password!
if (password.length > 0) {
  // Accept password
}
```
**Fix:** Enforce minimum length (8+), complexity, or use Better Auth defaults.

### 3.3 SQL Injection Risks

**❌ MISTAKE #7: String Concatenation in Queries**
```typescript
// DANGEROUS - SQL injection!
const query = `SELECT * FROM transactions WHERE userId = '${userId}'`;
```
**Fix:** Use Prisma (it's safe) or parameterized queries:
```typescript
// Safe with Prisma
const transactions = await db.transaction.findMany({
  where: { userId }
});
```

### 3.4 Other Common Mistakes

**❌ MISTAKE #8: Exposing Error Details**
```typescript
// DANGEROUS - leaks database structure!
catch (error) {
  return { error: error.message }; // Might expose table names, etc.
}
```
**Fix:** Return generic errors in production:
```typescript
catch (error) {
  console.error(error); // Log for debugging
  return { error: 'Something went wrong' }; // Generic message
}
```

**❌ MISTAKE #9: No Rate Limiting**
```typescript
// DANGEROUS - user can spam requests!
app.post('/api/transactions/extract', async (req) => {
  // No rate limit check
});
```
**Fix:** Add rate limiting middleware (bonus requirement).

**❌ MISTAKE #10: Using Float for Money**
```typescript
// DANGEROUS - precision errors!
amount: Float // 0.1 + 0.2 = 0.30000000000000004
```
**Fix:** While Decimal is better for pure finance, Float is used here for MongoDB compatibility. Ensure rounding is handled in UI/Backend logic.

---

## 4. TESTING CHECKLIST

### 4.1 Test Categories

#### ✅ Test 1: User Registration
**What to Test:**
- User can register with email + password
- Password is hashed (not stored in plain text)
- Duplicate email registration fails
- Invalid email format is rejected
- Weak password is rejected (if you add validation)

**How to Verify:**
```typescript
// Jest test
test('should register user with valid email and password', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ email: 'test@example.com', password: 'SecurePass123!' });
  
  expect(response.status).toBe(201);
  expect(response.body).toHaveProperty('user');
  expect(response.body.user.email).toBe('test@example.com');
  
  // Verify password is hashed in database
  const user = await db.user.findUnique({ where: { email: 'test@example.com' } });
  expect(user.password).not.toBe('SecurePass123!'); // Should be hashed
});
```

#### ✅ Test 2: User Login + JWT Generation
**What to Test:**
- User can login with correct credentials
- JWT token is returned
- JWT contains userId and organizationId
- JWT expires after 7 days
- Login fails with wrong password
- Login fails with non-existent email

**How to Verify:**
```typescript
test('should login and return valid JWT', async () => {
  // First register
  await request(app).post('/api/auth/register').send({
    email: 'test@example.com',
    password: 'SecurePass123!'
  });
  
  // Then login
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'test@example.com', password: 'SecurePass123!' });
  
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('token');
  
  // Verify JWT structure
  const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
  expect(decoded).toHaveProperty('userId');
  expect(decoded).toHaveProperty('organizationId');
  expect(decoded.exp).toBeGreaterThan(Date.now() / 1000); // Not expired
});
```

#### ✅ Test 3: Transaction Parsing (All 3 Formats)
**What to Test:**
- Sample 1 (clean format) parses correctly
- Sample 2 (different format) parses correctly
- Sample 3 (messy format) parses correctly
- Invalid text returns error or empty array
- Multiple transactions in one text are all extracted

**How to Verify:**
```typescript
test('should parse Sample 1 format correctly', async () => {
  const text = `Date: 11 Dec 2025
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50`;
  
  const response = await request(app)
    .post('/api/transactions/extract')
    .set('Authorization', `Bearer ${validJWT}`)
    .send({ text });
  
  expect(response.status).toBe(200);
  expect(response.body.transactions).toHaveLength(1);
  expect(response.body.transactions[0]).toMatchObject({
    description: 'STARBUCKS COFFEE MUMBAI',
    amount: -420.00,
    balance: 18420.50
  });
});

// Similar tests for Sample 2 and Sample 3
```

#### ✅ Test 4: Data Isolation (User A Cannot See User B's Data)
**What to Test:**
- User A creates transaction
- User B cannot see User A's transaction
- User B cannot modify User A's transaction (even with transaction ID)
- Filtering by userId from JWT works correctly

**How to Verify:**
```typescript
test('should prevent user A from seeing user B transactions', async () => {
  // Create two users
  const userA = await createTestUser('userA@example.com');
  const userB = await createTestUser('userB@example.com');
  
  // User A creates transaction
  const jwtA = await loginUser('userA@example.com');
  await request(app)
    .post('/api/transactions/extract')
    .set('Authorization', `Bearer ${jwtA}`)
    .send({ text: 'Sample transaction text' });
  
  // User B tries to see transactions
  const jwtB = await loginUser('userB@example.com');
  const response = await request(app)
    .get('/api/transactions')
    .set('Authorization', `Bearer ${jwtB}`);
  
  expect(response.status).toBe(200);
  expect(response.body.transactions).toHaveLength(0); // Should see nothing
});
```

#### ✅ Test 5: Protected Route Middleware
**What to Test:**
- Request without JWT is rejected (401)
- Request with invalid JWT is rejected (401)
- Request with expired JWT is rejected (401)
- Request with valid JWT is allowed (200)

**How to Verify:**
```typescript
test('should reject request without JWT', async () => {
  const response = await request(app)
    .get('/api/transactions');
  
  expect(response.status).toBe(401);
});

test('should reject request with invalid JWT', async () => {
  const response = await request(app)
    .get('/api/transactions')
    .set('Authorization', 'Bearer invalid-token');
  
  expect(response.status).toBe(401);
});
```

#### ✅ Test 6: Cursor Pagination
**What to Test:**
- First page returns correct number of items
- Cursor parameter returns next page
- Last page returns empty array or null cursor
- Cursor points to correct next item

**How to Verify:**
```typescript
test('should paginate transactions correctly', async () => {
  // Create 25 transactions
  const jwt = await loginUser('test@example.com');
  for (let i = 0; i < 25; i++) {
    await createTestTransaction(jwt);
  }
  
  // Get first page (limit 10)
  const page1 = await request(app)
    .get('/api/transactions?limit=10')
    .set('Authorization', `Bearer ${jwt}`);
  
  expect(page1.body.transactions).toHaveLength(10);
  expect(page1.body.nextCursor).toBeTruthy();
  
  // Get second page using cursor
  const page2 = await request(app)
    .get(`/api/transactions?limit=10&cursor=${page1.body.nextCursor}`)
    .set('Authorization', `Bearer ${jwt}`);
  
  expect(page2.body.transactions).toHaveLength(10);
  expect(page2.body.transactions[0].id).not.toBe(page1.body.transactions[0].id);
});
```

### 4.2 Manual Testing Checklist

**Authentication Flow:**
- [ ] Register new user → Check database for hashed password
- [ ] Login with correct credentials → Verify JWT in response
- [ ] Login with wrong password → Verify 401 error
- [ ] Access protected route without JWT → Verify 401 error
- [ ] Access protected route with expired JWT → Verify 401 error

**Transaction Extraction:**
- [ ] Paste Sample 1 format → Verify correct parsing
- [ ] Paste Sample 2 format → Verify correct parsing
- [ ] Paste Sample 3 format → Verify correct parsing
- [ ] Paste invalid text → Verify error handling
- [ ] Paste multiple transactions → Verify all are extracted

**Data Isolation:**
- [ ] Login as User A → Create transaction
- [ ] Login as User B → Verify cannot see User A's transaction
- [ ] Try to access User A's transaction ID directly → Verify 404/403
- [ ] Switch organizations → Verify only see current org's transactions

**Pagination:**
- [ ] Create 30 transactions
- [ ] Load first page → Verify 10 items
- [ ] Click "Next" → Verify next 10 items
- [ ] Click "Previous" → Verify previous page
- [ ] Verify cursor works correctly

**UI/UX:**
- [ ] Login page looks good (shadcn components)
- [ ] Register page looks good
- [ ] Dashboard shows transactions in table
- [ ] Pagination controls work
- [ ] Error messages are user-friendly

### 4.3 Security Testing Checklist

- [ ] Try to access another user's transaction by ID → Should fail
- [ ] Try to modify request to include another userId → Should be ignored
- [ ] Try SQL injection in text input → Should be sanitized
- [ ] Try XSS in description field → Should be escaped
- [ ] Check JWT expiry → Should expire after 7 days
- [ ] Verify password is hashed in database (not plain text)

---

## 5. SUCCESS CRITERIA

### What Success Looks Like:

1. **End-to-End Flow Works:**
   - User registers → logs in → pastes text → sees transactions → can paginate
   - All without errors

2. **Security is Solid:**
   - User A cannot see User B's data (even if they try to hack)
   - Passwords are hashed
   - JWTs expire correctly
   - Protected routes reject unauthorized requests

3. **Code is Clean:**
   - TypeScript strict mode (no `any` types)
   - Well-organized folder structure
   - Clear separation of concerns (auth, transactions, parsing)

4. **Tests Pass:**
   - All 6+ Jest tests pass
   - Tests cover critical paths

5. **Documentation:**
   - README explains setup
   - Code has comments where needed

---

## NEXT STEPS

After reviewing this document, we'll implement:
1. Backend setup (Hono, Prisma, Better Auth)
2. Database schema migration
3. Authentication endpoints
4. Transaction parsing logic
5. Protected API endpoints
6. Frontend pages (login, register, dashboard)
7. Auth.js integration
8. Jest tests
9. README documentation

Ready to start coding? Let me know when you want to begin! 🚀
