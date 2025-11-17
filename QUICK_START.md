# 🚀 Quick Start Commands

## Windows (PowerShell)

### One-Time Setup
```powershell
# Install dependencies
npm install

# Create .env file (copy from .env.example and fill in your values)
# Then start everything:
.\start.ps1
```

### Manual Steps (if script doesn't work)
```powershell
# 1. Start Docker services
docker-compose up -d

# 2. Wait 15 seconds, then run migrations
npm run db:migrate
npm run db:generate

# 3. Set up MinIO bucket at http://localhost:9001
#    - Login: minioadmin / minioadmin
#    - Create bucket: audiobranding-files
```

### Start Application
```powershell
# Terminal 1: Dev server
npm run dev

# Terminal 2: Background workers
npm run worker
```

### Access Points
- **App**: http://localhost:3000
- **MinIO Console**: http://localhost:9001
- **Prisma Studio**: `npm run db:studio` → http://localhost:5555

---

## Linux/Mac (Bash)

### One-Time Setup
```bash
# Install dependencies
npm install

# Make script executable
chmod +x start.sh

# Start everything
./start.sh
```

### Manual Steps (if script doesn't work)
```bash
# 1. Start Docker services
docker-compose up -d

# 2. Wait 15 seconds, then run migrations
npm run db:migrate
npm run db:generate

# 3. Set up MinIO bucket at http://localhost:9001
#    - Login: minioadmin / minioadmin
#    - Create bucket: audiobranding-files
```

### Start Application
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Background workers
npm run worker
```

---

## Testing Checklist

### ✅ 1. Health Check
```bash
curl http://localhost:3000/api/health
```
Expected: `{"status":"healthy","database":"connected","redis":"connected","s3":"connected"}`

### ✅ 2. Authentication
1. Visit http://localhost:3000
2. Click "Let's Start" → "Sign in with Google"
3. Complete OAuth flow
4. Should redirect to dashboard

### ✅ 3. Create Project
1. Fill in:
   - Brand Name: "Test Brand"
   - Website: "https://example.com"
   - (Optional) Upload PDF
2. Click "Generate Audio Branding"
3. Watch status: `pending` → `processing` → `done`

### ✅ 4. Finalize
1. After analysis completes, click "Finalize"
2. Wait for 5 audio files + 1 PDF to generate
3. Check right panel for artifacts
4. Click "Download" on any artifact

### ✅ 5. Verify in Database
```bash
npm run db:studio
```
Browse: User, Project, File, Analysis, Artifact tables

---

## Stop Everything

```bash
# Stop dev server: Ctrl+C in Terminal 1
# Stop worker: Ctrl+C in Terminal 2

# Stop Docker services
docker-compose down

# Remove all data (WARNING: deletes everything)
docker-compose down -v
```

---

## Troubleshooting

### Services won't start
```bash
docker-compose ps          # Check status
docker-compose logs        # View logs
docker-compose restart     # Restart services
```

### Database errors
```bash
npm run db:generate        # Regenerate Prisma client
npm run db:migrate         # Re-run migrations
make reset                 # Reset database (WARNING: deletes data)
```

### MinIO issues
1. Check http://localhost:9000 is accessible
2. Verify bucket `audiobranding-files` exists
3. Check `.env` has correct MinIO credentials

### Worker not processing
1. Check worker terminal for errors
2. Verify Redis is running: `docker-compose ps redis`
3. Check Redis connection: `docker exec audiobranding-redis redis-cli ping`

---

## Environment Variables Required

Create `.env` file with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/audiobranding"
REDIS_URL="redis://localhost:6379"
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback"
SESSION_SECRET="your-secret-min-32-chars"
JWT_SECRET="your-secret-min-32-chars"
PERPLEXITY_API_KEY="your-key"
REPLICATE_API_TOKEN="your-token"
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="minioadmin"
AWS_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET_NAME="audiobranding-files"
S3_ENDPOINT="http://localhost:9000"
S3_FORCE_PATH_STYLE="true"
```

### Perplexity Streaming Notes
- Chat streaming now lives at `POST /api/projects/:id/chat/stream` and emits Server-Sent Events containing `ack`, `token`, and `done` payloads. Keep the request open and append tokens as they arrive for a progressively rendered UI.
- The backend currently uses a lightweight fetch wrapper around Perplexity’s HTTP interface. If you need feature or error-parity with the official SDK, add `@perplexity-ai/perplexity_ai` to `package.json`, swap the helper in `src/lib/perplexity-client.ts`, and keep the streaming semantics identical so the frontend contract stays stable.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start services | `docker-compose up -d` or `make up` |
| Run migrations | `npm run db:migrate` or `make migrate` |
| Start dev server | `npm run dev` |
| Start workers | `npm run worker` |
| View database | `npm run db:studio` |
| Stop services | `docker-compose down` or `make down` |
| Reset database | `make reset` (WARNING: deletes data) |

---

For detailed testing guide, see **START.md**

