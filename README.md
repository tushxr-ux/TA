# Together — Private Chat App

Private, invite-only chat PWA for two people. WhatsApp-parity features: real-time messaging, media, typing indicators, read receipts, screen sharing, and date-range chat deletion with media toggle.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 PWA → Vercel |
| Backend | NestJS + Socket.IO → Railway |
| DB | PostgreSQL (Railway add-on) |
| Cache | Redis (Railway add-on) |
| Media | Cloudinary (free tier) |
| Push | Web Push API (VAPID) |
| Auth | JWT + Argon2id |

## Quick start

### Backend
```bash
cd backend
cp .env.example .env          # fill in values
docker compose up -d          # postgres + redis + minio locally
npm run start:dev             # http://localhost:4000
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm run dev                         # http://localhost:3000
```

## Environment variables

See [`backend/.env.example`](./backend/.env.example) for all required vars.

Frontend needs:
```
NEXT_PUBLIC_API_URL=https://your-railway-backend.up.railway.app/api/v1
```

## Deploy

- **Frontend** → push to GitHub → Vercel auto-deploys from `frontend/` subfolder
- **Backend** → push to GitHub → Railway deploys from `backend/` subfolder; add Postgres + Redis plugins

## Features (Phase 1 — built)
- ✅ PWA install popup (Android native + iOS guide)
- ✅ Invite-code registration (SHA-256 hashed, Argon2id passwords)
- ✅ Personal secret codes + QR for contact adding
- ✅ Contact requests — accept / reject / block
- ✅ Real-time 1:1 chat (Socket.IO)
- ✅ Typing indicators (animated dots)
- ✅ Message status: sent ✓ / delivered ✓✓ / read 🔵✓✓
- ✅ Image + voice note sending (Cloudinary)
- ✅ Web Push notifications (offline)
- ✅ **Date-range chat deletion** with storage estimate + keep/delete media toggle
- ✅ In-app toast notifications

## Phase 2 (planned)
- E2EE (libsignal / Signal Protocol)
- Live screen sharing (WebRTC + coturn)
- Disappearing messages, reactions, edit
