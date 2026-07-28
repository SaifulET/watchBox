# WatchBox Backend

WatchBox is a backend-only Node.js service for a luxury watch marketplace and analytics platform.

## Stack

- Node.js, TypeScript, Express.js
- MongoDB running in Docker and Mongoose
- Redis running in Docker
- RabbitMQ running in Docker
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

1. Install Docker Desktop and make sure it is running.

2. Review `.env.example` and provide backend service URLs and secrets as needed. If `.env` is missing, `npm run dev` creates it from `.env.example` without overwriting an existing file. MongoDB, Redis, and RabbitMQ values are already configured to use Docker containers:

```env
MONGODB_URI=mongodb://localhost:27017/watchbox
MONGODB_DATABASE=watchbox
REDIS_PASSWORD=change-me
RABBITMQ_USER=watchbox
RABBITMQ_PASSWORD=change-me
REDIS_URL=redis://default:${REDIS_PASSWORD}@localhost:6379
RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@localhost:5672/watchbox
```

3. Start MongoDB, Redis, and RabbitMQ:

```bash
npm run docker:up
```

Stop MongoDB, Redis, and RabbitMQ:

```bash
npm run docker:down
```

4. Install dependencies:

```bash
npm install
```

5. Start the API:

```bash
npm run dev
```

MongoDB, Redis, and RabbitMQ do not need to be installed on the host operating system.

RabbitMQ Dashboard:

- URL: `http://localhost:15672`
- Username: `watchbox`
- Password: use the value of `RABBITMQ_PASSWORD` from `.env`

Email delivery uses Nodemailer. The default `EMAIL_PROVIDER=local` uses Nodemailer's JSON transport, so local development does not require SMTP. To send real email, configure:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=no-reply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-user
SMTP_PASSWORD=your-password
WEB_APP_URL=http://localhost:3000
```

Health endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`

Readiness checks only MongoDB, Redis, and RabbitMQ when those clients are connected by the running server.

## Scripts

```bash
npm run docker:up
npm run docker:down
npm run docker:restart
npm run docker:logs
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
