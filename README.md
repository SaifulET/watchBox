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

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and provide backend service URLs and secrets.

3. Start the API:

```bash
npm run dev
```

Health endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Readiness checks only MongoDB, Redis, and RabbitMQ when those clients are connected by the running server.

## Scripts

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run seed
npm run mongo:indexes
npm run atlas:indexes
```

## API Documentation

OpenAPI documents live in `docs/openapi`. Swagger UI is available at `/docs` in non-production environments.

## Environment

The backend environment contract is documented in `.env.example` and validated in `src/config/env.ts`. Secrets must be supplied by the runtime environment for non-local deployments.
