# Audio Branding Next.js Backend

A Next.js 15 application with App Router for audio branding projects, featuring Google OAuth, LLM-powered analysis, and automated artifact generation.

## Features

- **Authentication**: Google OAuth with secure session management
- **Project Management**: Project-as-chat workflow for brand audio projects
- **File Uploads**: Presigned S3/MinIO uploads for client-side file handling
- **LLM Integration**: Perplexity API for exploratory and structured analysis
- **Audio Generation**: Replicate ace-step model for audio artifact creation
- **PDF Reports**: Automated PDF generation from structured data
- **Background Jobs**: BullMQ-powered queue for async processing
- **Type Safety**: Full TypeScript with Prisma ORM

## Tech Stack

- **Framework**: Next.js 15 with App Router, React 19, TypeScript
- **Database**: AWS RDS PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ (local for dev, AWS ElastiCache for production)
- **Storage**: AWS S3
- **LLM**: Perplexity API
- **Audio**: Replicate (ace-step model)
- **PDF Generation**: Built-in backend endpoint
- **Styling**: Tailwind CSS v4
- **Build Tool**: Turbopack

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local Redis)
- AWS Account with RDS PostgreSQL and S3 bucket configured
- Google OAuth credentials (for authentication)
- Perplexity API key
- Replicate API token

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd audiobrandingnext
npm install
```

### 2. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- Database connection string (DATABASE_URL) - will use local Postgres from docker-compose
- Redis URL (REDIS_URL) - will use local Redis from docker-compose
- S3/MinIO credentials (for local dev, use MinIO defaults)
- Google OAuth credentials
- Perplexity API key
- Replicate API token
- Session secrets (generate strong random strings)

### 3. Start Local Services

Start PostgreSQL, Redis, and MinIO using Docker Compose:

```bash
npm run docker:up
# or
make up
```

This will start:
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`
- MinIO on `localhost:9000` (API) and `localhost:9001` (Console)

**MinIO Setup:**
1. Access MinIO Console at http://localhost:9001
2. Login with `minioadmin` / `minioadmin` (or your configured credentials)
3. Create a bucket named `audiobranding-files` (or match your S3_BUCKET_NAME)

### 4. Database Setup

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
# or
make migrate
```

Optionally, seed the database with test data:

```bash
npm run db:seed
# or
make seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 6. Start Background Worker

In a separate terminal, start the background worker for processing analysis and finalize jobs:

```bash
npm run worker
```

The worker processes:
- Exploratory analysis jobs (Perplexity API calls)
- Finalize jobs (rigid JSON generation, Replicate audio generation, PDF generation)

## Available Scripts

### Development

- `npm run dev` - Start Next.js dev server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

### Testing

- `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

### Database

- `npm run db:migrate` - Create and apply new migration
- `npm run db:migrate:deploy` - Apply migrations (production)
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes without migration
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio GUI
- `npm run db:reset` - Reset database (WARNING: deletes all data)

### Docker

- `npm run docker:up` - Start all services (PostgreSQL, Redis, MinIO)
- `npm run docker:down` - Stop all services
- `npm run docker:reset` - Reset all services and volumes

### Makefile Commands

- `make migrate` - Run database migrations (dev mode)
- `make migrate-deploy` - Deploy migrations (production mode)
- `make seed` - Seed database with test data
- `make reset` - Reset database (WARNING: deletes all data)
- `make up` - Start all services (docker-compose)
- `make down` - Stop all services
- `make restart` - Restart all services
- `make clean` - Remove all volumes and containers

### Workers

- `npm run worker` - Start background job worker (processes analysis and finalize jobs)

## Project Structure

```
.
├── .github/
│   └── workflows/          # GitHub Actions CI/CD
├── prisma/
│   ├── migrations/         # Database migrations
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Database seed script
├── src/
│   ├── app/               # Next.js App Router pages
│   │   ├── api/          # API route handlers
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── lib/              # Utility functions and configs
│   ├── workers/          # Background job workers
│   └── types/            # TypeScript type definitions
├── tests/                # Test files
├── docker-compose.yml    # Local development services
├── .env.example         # Environment variables template
└── README.md           # This file
```

## Database Schema

The application uses the following main models:

- **User**: Google OAuth users with unique hashids
- **Project**: Brand projects (each project is a chat/workflow)
- **Message**: Chat messages within projects
- **File**: Uploaded files (logos, references, etc.)
- **Analysis**: LLM analysis jobs (exploratory or finalized)
- **Artifact**: Generated outputs (audio files, PDFs)

See `prisma/schema.prisma` for the complete schema.

## API Endpoints

### Authentication
- `GET /api/auth/signin` - Initiate Google OAuth flow (redirects to Google)
- `GET /api/auth/callback` - OAuth callback handler
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/user/me` - Get current user info

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Soft delete project

### Messages
- `GET /api/projects/:id/messages?limit&cursor` - List project messages (pagination)
- `POST /api/projects/:id/messages` - Send message
- `PATCH /api/messages/:id` - Update message
- `DELETE /api/messages/:id` - Soft delete (redact) message

### Files
- `POST /api/files/presign` - Get presigned upload URL
- `POST /api/files/register` - Register uploaded file metadata
- `GET /api/files/:id/presign-download` - Get presigned download URL
- `DELETE /api/files/:id` - Soft delete file

### Analysis
- `POST /api/analysis/start` - Start exploratory analysis
- `GET /api/analysis/:id/status` - Get analysis status (pollable)
- `GET /api/analysis/:id/result` - Get analysis result (when done)
- `POST /api/analysis/:id/finalize` - Start finalization (rigid JSON + 5 audio + 1 PDF)
- `GET /api/analyses/:id/artifacts` - List generated artifacts
- `GET /api/artifacts/:id/presign-download` - Get presigned download URL for artifact

### Chat
- `POST /api/projects/:id/chat` - Send chat message and get LLM response

### Jobs (Debugging)
- `GET /api/jobs/:id?queue=analysis|finalize` - Get job status

### Health
- `GET /api/health` - Health check (DB, Redis, S3 connectivity)

## Environment Variables

See `.env.example` for all required environment variables. Key variables:

### Database
- `DATABASE_URL` - PostgreSQL connection string

### Redis
- `REDIS_URL` - Redis connection string

### AWS S3
- `AWS_REGION` - AWS region (e.g., us-east-1)
- `AWS_ACCESS_KEY_ID` - IAM user access key
- `AWS_SECRET_ACCESS_KEY` - IAM user secret key
- `S3_BUCKET_NAME` - S3 bucket name

### Authentication
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `SESSION_SECRET` - Session encryption key
- `JWT_SECRET` - JWT signing key

### External APIs
- `PERPLEXITY_API_KEY` - Perplexity API key
- `REPLICATE_API_TOKEN` - Replicate API token

## Testing

The project includes a comprehensive test suite with Jest and ts-jest.

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Test Structure

- Unit tests for utilities and services
- Integration tests for API endpoints
- Mock implementations for external services (S3, Perplexity, Replicate)

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Lint**: ESLint checks
2. **Test**: Run test suite with coverage
3. **Build**: Production build verification

The CI pipeline uses PostgreSQL and Redis service containers for integration tests.

## Production Deployment

### Environment Variables

Ensure all production environment variables are set, especially:
- Use production AWS RDS instance with proper security groups
- Use production S3 bucket with appropriate IAM policies
- Generate strong random secrets for `SESSION_SECRET` and `JWT_SECRET`
- Use AWS ElastiCache for Redis in production

### Database Migrations

Apply migrations in production:

```bash
npm run db:migrate:deploy
```

### Build and Start

```bash
npm run build
npm start
```

### Worker Deployment

Deploy the worker separately (e.g., as a separate service/container):

```bash
npm run worker
```

## Development Roadmap

### Stage 0 ✓ (Current)
- Repo scaffold & infrastructure setup
- Docker Compose for local development
- Prisma schema and migrations
- CI/CD pipeline

### Stage 1 (Next)
- Google OAuth implementation
- Session management
- Basic user endpoints

### Stage 2
- Project CRUD endpoints
- Message/chat functionality

### Stage 3
- S3 presigned uploads
- File management

### Stage 4
- Perplexity LLM integration
- Exploratory analysis

### Stage 5
- Finalization workflow
- Replicate audio generation
- PDF generation
- Artifact storage

### Stage 6
- Background worker implementation
- Job queue processing
- Error handling and retries

## Troubleshooting

### Database Connection Issues

If you can't connect to AWS RDS:
1. Check security group allows your IP address
2. Verify DATABASE_URL format in .env
3. Ensure RDS instance is publicly accessible (or use VPN/bastion)

### Redis Connection Issues

Check if Redis is running:
```bash
docker ps | grep redis
```

If not running:
```bash
npm run docker:up
```

### S3 Upload Issues

1. Verify AWS credentials have S3 permissions
2. Check bucket exists and is in the correct region
3. Ensure CORS is configured for presigned uploads

### Prisma Issues

Regenerate Prisma client:
```bash
npm run db:generate
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Submit a pull request

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.
