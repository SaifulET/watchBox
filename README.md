# WatchBox Backend

WatchBox is a backend-only Node.js service for a luxury watch marketplace and analytics platform.

## Stack

- Node.js, TypeScript, Express.js
- MongoDB and Mongoose
- Redis
- RabbitMQ
- Zod validation
- JWT authentication helpers
- Argon2id password hashing
- Pino structured logging
- Swagger/OpenAPI
- Vitest and Supertest
- S3-compatible storage abstraction
- Atlas Search and Atlas Vector Search configuration
- Stripe, email, push, marketplace, and AI provider abstractions

## Local Setup

1. Enable pnpm through Corepack if a global pnpm executable is unavailable:

```bash
corepack prepare pnpm@9.15.4 --activate
```

2. Install dependencies:

```bash
corepack pnpm install
```

3. Copy `.env.example` to `.env` and provide backend service URLs and secrets.

4. Start the API:

```bash
corepack pnpm dev
```

Health endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Readiness checks only MongoDB, Redis, and RabbitMQ when those clients are connected by the running server.

## Scripts

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm seed
corepack pnpm mongo:indexes
corepack pnpm atlas:indexes
```

## API Documentation

OpenAPI documents live in `docs/openapi`. Swagger UI is available at `/docs` in non-production environments.

## Environment

The backend environment contract is documented in `.env.example` and validated in `src/config/env.ts`. Secrets must be supplied by the runtime environment for non-local deployments.
