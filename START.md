# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Docker and Docker Compose installed
- npm or yarn package manager

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/audiobranding"

# Redis
REDIS_URL="redis://localhost:6379"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# Session & JWT
SESSION_SECRET="your-super-secret-session-key-min-32-chars"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"

# Perplexity API
PERPLEXITY_API_KEY="your-perplexity-api-key"

# Replicate API
REPLICATE_API_TOKEN="your-replicate-api-token"

# AWS S3 (or MinIO for local)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET_NAME="audiobranding-files"
S3_ENDPOINT="http://localhost:9000"
S3_FORCE_PATH_STYLE="true"
```

## Step 3: Start All Services

### Option A: Using Make (Recommended)

```bash
# Start Docker services (PostgreSQL, Redis, MinIO)
make up

# Wait 10-15 seconds for services to be ready, then run migrations
make migrate

# Generate Prisma client
npm run db:generate
```

### Option B: Using Docker Compose Directly

```bash
# Start all services
docker-compose up -d

# Wait for services to be ready, then run migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

### Option C: One-Line Startup (PowerShell)

```powershell
docker-compose up -d; Start-Sleep -Seconds 15; npm run db:migrate; npm run db:generate
```

## Step 4: Set Up MinIO Bucket

After MinIO starts, you need to create the bucket:

1. Open MinIO Console: http://localhost:9001
2. Login with:
   - Username: `minioadmin`
   - Password: `minioadmin`
3. Click "Create Bucket"
4. Bucket name: `audiobranding-files`
5. Click "Create Bucket"

## Step 5: Start Development Server

In **Terminal 1**:
```bash
npm run dev
```

The app will be available at: http://localhost:3000

## Step 6: Start Background Workers

In **Terminal 2** (new terminal):
```bash
npm run worker
```

This runs the BullMQ workers for:
- Exploratory analysis jobs
- Finalize jobs (audio generation + PDF)

---

## Complete Startup Script (All-in-One)

Create a file `start.ps1` (PowerShell) or `start.sh` (Bash):

### PowerShell (`start.ps1`):
```powershell
Write-Host "Starting services..." -ForegroundColor Green
docker-compose up -d

Write-Host "Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

Write-Host "Running database migrations..." -ForegroundColor Green
npm run db:migrate

Write-Host "Generating Prisma client..." -ForegroundColor Green
npm run db:generate

Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Set up MinIO bucket at http://localhost:9001" -ForegroundColor Cyan
Write-Host "2. Run 'npm run dev' in Terminal 1" -ForegroundColor Cyan
Write-Host "3. Run 'npm run worker' in Terminal 2" -ForegroundColor Cyan
```

### Bash (`start.sh`):
```bash
#!/bin/bash

echo "Starting services..."
docker-compose up -d

echo "Waiting for services to be ready..."
sleep 15

echo "Running database migrations..."
npm run db:migrate

echo "Generating Prisma client..."
npm run db:generate

echo "✅ All services started!"
echo "Next steps:"
echo "1. Set up MinIO bucket at http://localhost:9001"
echo "2. Run 'npm run dev' in Terminal 1"
echo "3. Run 'npm run worker' in Terminal 2"
```

---

## Testing Guide

### 1. Health Check

Test if all services are running:

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "s3": "connected"
}
```

### 2. Authentication Flow

1. **Visit Welcome Page**
   - Go to: http://localhost:3000
   - Should redirect to `/welcome`
   - Click "Let's Start"

2. **Sign In with Google**
   - Click "Sign in with Google"
   - Complete Google OAuth flow
   - Should redirect to `/dashboard`

3. **Check User Session**
   - Open browser DevTools → Application → Cookies
   - Should see `session` cookie set
   - Dashboard should show your user email in sidebar

### 3. Create a Project

1. **Fill in Brand Details**
   - Brand Name: "Test Brand"
   - Website: "https://example.com"
   - (Optional) Upload a PDF file

2. **Click "Generate Audio Branding"**
   - Should show "Processing..." on button
   - Should create project in database
   - Should start exploratory analysis

3. **Check Analysis Status**
   - Should see "Analysis Status: pending" or "processing"
   - Status updates automatically every 3 seconds
   - Wait for status to become "done" (may take 1-2 minutes)

### 4. Test File Upload

1. **Upload a File**
   - Select a PDF file in the upload area
   - File should upload to MinIO
   - Check MinIO console: http://localhost:9001
   - Should see file in `audiobranding-files` bucket

### 5. Test Analysis Flow

1. **Monitor Analysis Progress**
   - Watch the analysis status in dashboard
   - Check worker terminal for logs
   - Status should change: `pending` → `processing` → `done`

2. **View Analysis Result**
   - Once status is "done", you can finalize
   - Click "Finalize (Generate 5 Audio + PDF)" button
   - This starts the finalize job

### 6. Test Finalize Flow

1. **Start Finalization**
   - Click "Finalize" button after analysis completes
   - Should show new status polling
   - Worker will:
     - Call Perplexity rigid JSON endpoint
     - Generate 5 audio files via Replicate
     - Generate 1 PDF report
     - Upload all to S3

2. **Check Artifacts**
   - Once finalize completes, artifacts appear in right panel
   - Should see 5 audio files + 1 PDF
   - Click "Download" to get presigned URLs

### 7. Test Project Management

1. **View Projects in Sidebar**
   - Should see all your projects listed
   - Click a project to load it
   - Click "Create New" to start fresh

2. **Check Database**
   - Run: `npm run db:studio`
   - Opens Prisma Studio at http://localhost:5555
   - Browse tables: User, Project, File, Analysis, Artifact, Message

### 8. API Testing (Optional)

Use curl or Postman to test endpoints directly:

```bash
# Get current user (requires session cookie)
curl -b cookies.txt http://localhost:3000/api/user/me

# List projects
curl -b cookies.txt http://localhost:3000/api/projects

# Create project
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  -d '{"brandName":"Test","brandWebsite":"https://example.com"}' \
  http://localhost:3000/api/projects
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs minio

# Restart services
make restart
```

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection
psql postgresql://postgres:postgres@localhost:5432/audiobranding

# Reset database (WARNING: deletes all data)
make reset
```

### MinIO Not Working

1. Check MinIO is running: http://localhost:9000
2. Check MinIO Console: http://localhost:9001
3. Verify bucket exists: `audiobranding-files`
4. Check environment variables match MinIO credentials

### Worker Not Processing Jobs

1. Check worker is running: `npm run worker`
2. Check Redis connection: `docker-compose logs redis`
3. Check job queue in Redis:
   ```bash
   docker exec -it audiobranding-redis redis-cli
   KEYS *
   ```

### OAuth Not Working

1. Verify Google OAuth credentials in `.env`
2. Check redirect URI matches: `http://localhost:3000/api/auth/callback`
3. Ensure Google OAuth consent screen is configured
4. Check browser console for errors

---

## Stop Everything

```bash
# Stop dev server (Ctrl+C in Terminal 1)
# Stop worker (Ctrl+C in Terminal 2)

# Stop Docker services
make down
# or
docker-compose down

# Remove all data (WARNING: deletes everything)
make clean
```

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `make up` | Start all Docker services |
| `make down` | Stop all Docker services |
| `make migrate` | Run database migrations |
| `make reset` | Reset database (deletes data) |
| `npm run dev` | Start Next.js dev server |
| `npm run worker` | Start background workers |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test` | Run tests |

---

## Next Steps After Testing

1. ✅ Verify all services are running
2. ✅ Test authentication flow
3. ✅ Create a project
4. ✅ Upload a file
5. ✅ Start analysis
6. ✅ Wait for analysis to complete
7. ✅ Finalize to generate artifacts
8. ✅ Download generated files

If everything works, you're ready to use the application! 🎉

