# Roadmap, Costs & Testing

## Phase 0: Setup (1 week)
- Repo, CI, Docker Compose (Postgres, Redis, MinIO)
- Design system and app skeleton

## Phase 1: MVP (4-6 weeks)
- Invite-code registration and login
- Personal secret code + QR, contact requests
- 1:1 text chat over WebSocket, receipts, typing, presence
- Chat list, unread counts, local SQLite storage
- Push notifications
- Image and voice note sending
- Delete for everyone, reply
- Admin CLI for invites

## Phase 2: Parity (6-8 weeks)
- E2EE with libsignal
- Video, documents, location, contacts, emoji reactions, forward, edit, star
- Search, archive, pin, mute, disappearing messages
- Live screen sharing (WebRTC + coturn): Android first, then iOS ReplayKit
- Privacy settings, app lock
- Admin dashboard

## Phase 3: Polish (4+ weeks)
- Stickers, wallpapers, themes, localization
- Performance work, accessibility

## Suggested team/time
Solo dev: roughly 6-9 months for near parity. Small team (2 mobile + 1 backend): 3-4 months.

## Estimated monthly cost (two users)
| Item | Approx. |
|------|---------|
| VPS (4GB RAM) | $10-24 |
| Managed Postgres (optional) | $15 |
| Object storage (50-100 GB) | $2-5 |
| TURN server for screen sharing (same VPS or separate) | $0-10 |
| Domain | $1 |
| Firebase (FCM) | Free |
| Apple Developer (iOS) | $99/year |
| Google Play (one-time) | $25 |

## Testing plan
- **Unit:** auth, invite logic, code generation, permissions
- **Integration:** message flow, receipts, offline sync
- **E2E (mobile):** Flutter integration tests / Detox
- **Load:** k6 or Artillery on WebSocket (target 1,000 concurrent)
- **Security:** brute-force tests on codes, auth bypass, OWASP checklist
- **Manual:** poor network, airplane mode toggling, app kill/restart, multi-device

## Legal and store notes
- Publish a privacy policy if distributing through stores.
- Apps with E2EE may have export or regional regulation considerations; check local rules.
- For a purely private friends/family app, direct APK or TestFlight avoids public store review.

## Quick-start prompt for AI coding tools
> Build the backend described in ARCHITECTURE.md using NestJS, PostgreSQL (schema in DATABASE.md), and Socket.IO. Implement the invite and contact-code flow from INVITE_SYSTEM.md first, then 1:1 chat with delivery/read receipts per API_SPEC.md.
