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

- Build command: `npm install && npx prisma generate && npx prisma db push && npm run build`
- Start command: `npm start`
- Required env:
  - `DATABASE_URL` (MongoDB production URI)
  - `BETTER_AUTH_SECRET` (and/or `AUTH_SECRET`)
  - `BACKEND_URL` (your deployed backend URL)
  - `FRONTEND_URL` (your deployed frontend URL)
  - `NODE_ENV=production`

### Frontend (Vercel)

Project settings:

- Root Directory: `frontend`
- Required env:
  - `NEXT_PUBLIC_BACKEND_URL=<your backend url>`

## Notes

- Prisma datasource provider is currently MongoDB.
- Backend CORS and Better Auth trusted origins include localhost and configured frontend URL.
- If you rotate secrets or move databases, existing sessions/tokens may be invalidated.
