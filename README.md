# Vaishnavi Enterprises E-Commerce (v2.0)

This is the project workspace directory for **Vaishnavi Enterprises E-Commerce**, built using a **Custom Full-Stack Next.js (App Router) + Prisma + SQLite (Local Dev) / Supabase PostgreSQL (Prod)** stack.

## Folder Path
`C:\Users\black\.gemini\antigravity\scratch\vaishnavi-enterprises`

> [!TIP]
> **Active Workspace**: Please set this folder as your active workspace in your IDE to proceed with development and execution.

## Architecture

This is a unified, serverless monolithic application designed for **Rs 0 hosting costs** in production.

*   `src/app/` - Storefront and custom admin views (APIs and Server Actions).
*   `prisma/` - Database schemas and migrations using Prisma ORM.
*   `src/components/` - Unified responsive design system and glassmorphism elements.
*   `src/lib/` - Shared utilities, auth options, and database client.

## Setup & Running Locally

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Sync & Seeding**:
   ```bash
   npx prisma db push --force-reset
   node prisma/seed.js
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The local development server will start at `http://localhost:3000`.

4. **Production Build**:
   ```bash
   npm run build
   ```

## GitHub CI/CD Deployment (Vercel)

This project has an automated CI/CD pipeline configured with GitHub Actions. On every push or pull request to the `main` branch, the pipeline will run quality checks (linting, type checking, and compilation builds) and deploy the app to Vercel.

### Required GitHub Secrets

To make the deployment work, configure the following secrets under **Settings > Secrets and variables > Actions** in your GitHub repository:

1. **`VERCEL_TOKEN`**: A Vercel Personal Access Token generated at [Vercel Token Settings](https://vercel.com/account/tokens).
2. **`VERCEL_ORG_ID`**: Your Vercel Account or Organization ID. You can find this in your project settings on Vercel or run `vercel link` locally.
3. **`VERCEL_PROJECT_ID`**: The Vercel Project ID of this linked project.
4. **`DATABASE_URL`**: The connection string for your production database (e.g. Supabase PostgreSQL database URL) to run Prisma migrations automatically before deploying:
   `postgresql://user:password@host:port/db?schema=public`
