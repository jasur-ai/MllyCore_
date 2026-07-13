# 🚀 MllyCore — Vercel Deployment Guide

## Prerequisites

- Node.js 18+ 
- Vercel CLI: `npm install -g vercel`
- Firebase project with **Firestore** enabled
- GitHub Personal Access Token (for T31)

---

## 1. 🔧 Environment Variables

Set these in **Vercel Dashboard** (`https://vercel.com/<project>/settings/environment-variables`):

### Required (⚠️)

| Variable | Description | How to get |
|----------|-------------|------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin SDK key (JSON) | Firebase Console → Settings → Service Accounts → Generate key |
| `GITHUB_TOKEN` | GitHub PAT for Issues API | https://github.com/settings/tokens → `public_repo` scope |

### Optional (ℹ️)

| Variable | Description | Feature |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | T22 notifications + T53 weekly report |

### Setup via CLI

```bash
# Production
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON production
vercel env add GITHUB_TOKEN production
vercel env add TELEGRAM_BOT_TOKEN production

# Preview (optional)
vercel env add FIREBASE_SERVICE_ACCOUNT_JSON preview
```

---

## 2. 🔐 GitHub Token (T31)

### Creating a token

1. Go to https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes: `public_repo` (public repos) or `repo` (private repos)
4. Generate and copy the token

### How T31 uses the token

```
Client (brauzer)                              GitHub API
┌──────────────────┐                         ┌──────────┐
│ 1. Task + repo    │  POST /api/sync-github  │          │
│    + token (opt)  │ ─────────────────────→   │ POST     │
│                   │                         │ /repos/  │
│ 2. Server tekshir │                         │ {repo}/  │
│    role → token   │                         │ issues   │
│    fallback:      │                         │          │
│    GITHUB_TOKEN   │ ←─────────────────────  │          │
│    env            │  { id, html_url }       │          │
│                   │                         └──────────┘
│ 3. githubIssueId  │
│    + url → task   │
└──────────────────┘
```

**Token priority:**
1. User-supplied token (from `window.prompt` in team.html)
2. `GITHUB_TOKEN` environment variable (fallback)

**Security:** Token is NEVER stored in Firestore — only used in-memory for the API call.

---

## 3. 📦 Deploy

### First-time deploy

```bash
# Login
vercel login

# Deploy
vercel --prod

# Or link existing project
vercel link
vercel --prod
```

### Subsequent deploys

```bash
vercel --prod
# or via GitHub integration (auto-deploy on push to main)
```

### Deploy only API

```bash
vercel deploy --prod --force
```

---

## 4. ✅ Post-deploy verification

### Health check

```bash
curl https://<your-domain>.vercel.app/api/health
# Expected: { "status": "ok", "firebase": true, ... }
```

### T31 test (with valid repo + taskId)

```bash
curl -X POST https://<your-domain>.vercel.app/api/sync-github \
  -H "Authorization: Bearer <id-token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<task-id>","repo":"<user/repo>","token":"<github-token>"}'
```

### Vercel Dashboard checks

- [ ] Environment variables set
- [ ] Firebase Admin SDK initializes (no 500 errors)
- [ ] T31 GitHub API responds (200 or meaningful error)
- [ ] Cron job `/api/weekly-digest` scheduled (Monday 09:00)

---

## 5. 🔄 Local development

```bash
# 1. Start Firebase Emulators
npm run dev

# 2. Run T16 storage test
npm run test:t16

# 3. Run smoke tests (requires Java for emulator)
npm run test:smoke
```

---

## 6. 📋 Required Vercel project settings

| Setting | Value |
|---------|-------|
| **Framework** | Other |
| **Build Command** | (none — static + serverless) |
| **Output Directory** | . |
| **Node.js Version** | 20.x (or 18+) |
| **Region** | `iad1` (US East) or your nearest |

---

## 7. 🔐 Security notes

- `GITHUB_TOKEN` is an env var — never exposed to client
- Client can optionally provide their own token (bypasses rate limits)
- Token is only used in `handleSyncGithub` request — not persisted
- All API endpoints require Firebase Auth token verification
