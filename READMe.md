# Parsify - Universal Transaction Parser

Universal transaction parser built as a full-stack monorepo. Users can sign up, paste raw bank statement text, and store/retrieve parsed transactions with org-level isolation.

## 🔗 Live URLs

- Frontend: [https://vessify-frontend.vercel.app](https://vessify-frontend.vercel.app)
- Backend: [https://vessify-backend-9o4i.onrender.com](https://vessify-backend-9o4i.onrender.com)

## 🚀 Tech Stack

### Frontend (`frontend`)
- Next.js 15 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui + Radix UI
- Better Auth client integration

### Backend (`backend`)
- Hono + TypeScript (Node runtime)
- Better Auth (email/password + JWT + organizations)
- Prisma ORM (`provider = "mongodb"`)
- MongoDB
- Jest + Supertest for tests

### Monorepo
- npm workspaces
- `concurrently` for running frontend + backend together

## ✨ Features

- ✅ Universal Parser : Parse free-form transaction text into structured data
- ✅ Secure Auth : Auth with Better Auth (`/api/auth/*`)
- ✅ Organization Isolation : Organization-based multi-tenancy
- ✅ Middleware : Protected transaction APIs with auth middleware
- ✅ Pagination : Cursor-style pagination on transaction listing
- ✅ Smart Pattern Support: 40+ built-in patterns for UPI, Credit Cards, ATM, Salary, and International transactions.
- ✅ Smart Validation: Advanced amount validation and confidence scoring for high accuracy.

## 🧪 Test With:
- UPI payments (PhonePe, GPay, PayTM)
- Credit card statements
- ATM withdrawals
- Salary credits
- International transactions

## Screenshots

### Homepage / Dashboard
![Homepage](assets/dashboard.png)

### Parsing Feature
![Parsing Feature](assets/parsing.png)


## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- MongoDB connection string (Atlas/local)

### 1) Clone and install

```bash
git clone https://github.com/SakshiAwasthi19/Parsify
cd Parsify
npm install
```

### 2) Backend env

Create `backend/.env` using `backend/.env.example`:

```env
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority"
BETTER_AUTH_SECRET="replace-with-a-secure-random-string"
AUTH_SECRET="optional-fallback-secret"
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"
```

### 3) Frontend env

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
```

### 4) Generate Prisma client and sync schema

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

### 5) Run locally

Run both apps from repo root:

```bash
npm run dev
```

Or run separately:

```bash
npm run dev:backend
npm run dev:frontend
```

Open `http://localhost:3000`.

## 🧪 Testing Instructions

### Backend Tests
The backend uses Jest and Supertest for API and isolation testing.

```bash
cd backend
npm test
```

To run tests with coverage:
```bash
npm run test:coverage
```

### Frontend Tests
(Add frontend tests if applicable, otherwise mention manual verification)
Currently, frontend verification is performed manually by logging in and testing the transaction extraction flow.

## 👤 Test User Credentials

For testing purposes, you can use the following credentials or register a new account:

- **Email**: `test@example.com`
- **Password**: `Password123!`

*Note: If testing on a live deployment, please register a new account as the database may be cleared periodically.*

## 📋 Sample Test Data

Copy and paste these examples into the application to test the parsing functionality:

### 1. Bank Statement (Labeled)
```text
Date: 28 Feb 2026
Description: STARBUCKS COFFEE MUMBAI
Amount: -420.00
Balance after transaction: 18,420.50
```

### 2. Mobile Notification (Compact)
```text
Paid ₹1,250.00 to Uber Ride on 10-12-2025. Avl Bal: ₹17,170.50
```

### 3. Credit Card / Retail
```text
Reliance Digital * Mumbai 
15/01/2026 → ₹45,999.00 debited
Available Limit → ₹54,000.00
```

### 4. Salary / Credit
```text
Date: 01-Mar-2026 Salary Credit Rs. 85,000.00 Bal 96,200.00
```

## 🔐 Environment Variables



### Backend (`backend/.env`)

- `DATABASE_URL` (required): MongoDB connection string used by Prisma
- `BETTER_AUTH_SECRET` (recommended): Better Auth signing secret
- `AUTH_SECRET` (optional): fallback secret used by backend code
- `BACKEND_URL` (recommended): public/backend base URL used by Better Auth
- `FRONTEND_URL` (recommended): allowed origin for CORS and trusted origins
- `NODE_ENV` (optional): `development` or `production`
- `PORT` (optional): defaults to `3001`

### Frontend (`frontend/.env.local`)

- `NEXT_PUBLIC_BACKEND_URL` (required): backend origin used by `frontend/src/lib/api.ts`

## 📡 API Overview

### Health / Utility
- `GET /` -> backend status/version
- `GET /health` -> health response

### Auth (`/api/auth/*`)

- Better Auth core endpoints (for example):
  - `POST /api/auth/sign-up/email`
  - `POST /api/auth/sign-in/email`
  - `GET /api/auth/session`
  - `POST /api/auth/sign-out`
- Custom route:
  - `GET /api/auth/token` -> fetch current session token

### Transactions (`/api/transactions`)

- `POST /extract` -> parse and store transaction from `{ "text": string }`
- `GET /` -> list current user's transactions (`cursor`, `limit`)
- `GET /:id` -> get one transaction (ownership checked)
- `DELETE /:id` -> delete one transaction (ownership checked)

## Scripts

### Root

- `npm run dev` -> run frontend + backend together
- `npm run dev:backend` -> backend dev server
- `npm run dev:frontend` -> frontend dev server
- `npm test` -> backend test suite

### Backend

- `npm run dev` -> `tsx watch src/index.ts`
- `npm run build`
- `npm start`
- `npm test`
- `npm run test:watch`
- `npm run test:coverage`
- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`
- `npm run prisma:studio`
- `npm run lint`
- `npm run type-check`

### Frontend

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run type-check`

## 📂 Project Structure

```text
Parsify/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts
│   │   │   ├── db.ts
│   │   │   └── parser.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   └── transactions.routes.ts
│   │   ├── app.ts
│   │   └── index.ts
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── dashboard/page.tsx
│   │   ├── components/ui/
│   │   └── lib/
│   │       ├── api.ts
│   │       └── auth.ts
│   └── public/
├── package.json
└── READMe.md
```

## Production Deployment

### Backend (Render or similar)

Service settings (`Root Directory`: `backend`):

- **Build Command**: `npm install && npx prisma generate && npx prisma db push && npm run build`
- **Start Command**: `npm start` (Runs `tsx src/index.ts`)
- **Required Environment Variables**:
  - `DATABASE_URL`: MongoDB production connection string.
  - `BETTER_AUTH_SECRET`: A 32-character random string for session signing.
  - `BACKEND_URL`: The public URL of your deployed backend.
  - `FRONTEND_URL`: The public URL of your deployed frontend (for CORS).
  - `NODE_ENV`: Set to `production`.

### Frontend (Vercel)

Project settings:

- **Root Directory**: `frontend`
- **Build Command**: `next build`
- **Required Environment Variables**:
  - `NEXT_PUBLIC_BACKEND_URL`: The public URL of your deployed backend.

## Notes

- Prisma datasource provider is currently MongoDB.
- Backend CORS and Better Auth trusted origins include localhost and configured frontend URL.
- If you rotate secrets or move databases, existing sessions/tokens may be invalidated.
