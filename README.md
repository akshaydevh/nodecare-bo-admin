# NOD Care — Back Office Admin

Web dashboard for platform operators (`root` / `support`).

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- React Query + React Router
- Talks to `core-backend` `/api/v1/admin/*`

## Setup

```bash
cp .env.example .env
# Point VITE_API_BASE_URL at your API (local or Railway)

npm install
npm run dev
```

App runs at `http://localhost:5173`.

Ensure the API `CORS_ORIGINS` includes this origin.

## First login

1. On the API: `npm run seed:admin`
2. Sign in with `root` / `123456`
3. You will be forced to change the password before the dashboard unlocks

## Screens

- Dashboard / Analytics
- Users
- Onboarding
- Catalog
- CMS (carousel + feature tabs)
- Settings
