# Parsify

Universal transaction parser built as a full-stack monorepo. Users can sign up, paste raw bank statement text, and store/retrieve parsed transactions with org-level isolation.

## Live URLs

- Frontend: [https://parsify-frontend.vercel.app/](https://parsify-frontend.vercel.app/)
- Backend: [https://parsify-backend.onrender.com](https://parsify-backend.onrender.com)

## Features

- Parse free-form transaction text into structured data
- Auth with Better Auth (`/api/auth/*`)
- Organization-based multi-tenancy
- Protected transaction APIs with auth middleware
- Cursor-style pagination on transaction listing

## Tech Stack

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

## 📸 Screenshots

| Dashboard View | Transaction Parsing |
|:---:|:---:|
| ![Dashboard View](./assets/dashboard.png) | ![Transaction Parsing](./assets/parsing.png) |

---

*Built for Vessify Internship Assignment*

## Test User Credentials

Use these demo accounts for quick login and testing:

| Role | Email | Password |
|---|---|---|
| User 1 | `demo@example.com` | `password123` |
| User 2 | `test@parsify.com` | `securePass!789` |

## Sample Data for Parsing

Copy-paste any of the following into the transaction parser input:

```text
You sent Rs. 1250 to merchant@upi on 18-Apr-2026. Avl Bal: Rs. 9340
```

```text
HDFC CC: SWIGGY BANGALORE 17/04/26 Rs.850.00 debited. Avl Limit 45000
```

```text
ATM Withdrawal Rs. 2000 on 16-APR-2026. Remaining Bal Rs. 15500
```

```text
Salary credit of Rs. 52,000 received on 01-Apr-2026. Available balance Rs. 73,420
```

```text
NEFT transfer to RENT123 on 05/04/2026 amount Rs.18000. Balance Rs. 24420
```

## Testing Instructions

### Manual app testing

1. Open [https://parsify-frontend.vercel.app/](https://parsify-frontend.vercel.app/).
2. Login with one of the test users above (or register a new user).
3. Paste one sample transaction from this README.
4. Click **Extract Transaction** and verify a success response.
5. Confirm parsed records appear in the transactions table.
6. Test pagination by adding multiple entries and loading more.

### API smoke testing

Backend health:

```bash
curl https://parsify-backend.onrender.com/health
```

Backend root:

```bash
curl https://parsify-backend.onrender.com/
```

### Local automated tests

```bash
cd backend
npm test
```

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

## Environment Variables

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

## API Overview

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

## Project Structure

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