# Architecture

## High-level diagram
```
 ┌──────────────┐        HTTPS (REST)        ┌─────────────────────┐
 │ Mobile App   │ ─────────────────────────► │  API Server (NestJS)│
 │ Flutter / RN │ ◄───────────────────────── │  Auth, Contact, Chat│
 │              │       WebSocket            │                     │
 │ Local DB     │ ◄════════════════════════► │  Realtime Gateway   │
 │ (SQLite)     │                            └─────────┬───────────┘
 └──────────────┘                          ┌───────────┼─────────────┐
                                           ▼           ▼             ▼
                                     ┌──────────┐ ┌─────────┐ ┌───────────┐
                                     │PostgreSQL│ │  Redis  │ │ S3 / MinIO│
                                     └──────────┘ └─────────┘ └───────────┘
                                                       │
                                                       ▼
                                              FCM / APNs (push)

         + coturn (TURN/STUN) server for screen-share media relay
```

## Components
| Component | Responsibility |
|-----------|----------------|
| **Auth service** | Invite validation, register, login, JWT access + refresh tokens |
| **Contact service** | Secret code generation, contact requests, blocking |
| **Chat service** | Conversation, messages, receipts |
| **Realtime gateway** | WebSocket connections, typing, presence, message fan-out |
| **Screen-share signaling** | Relays WebRTC offer/answer/ICE between the two phones; issues short-lived TURN credentials |
| **Media service** | Pre-signed upload/download URLs, thumbnails, virus/size checks |
| **Notification service** | Push via FCM/APNs when user is offline |
| **Admin service** | Invite code management, moderation |

## Message flow (1:1)
1. Sender encrypts message on device (E2EE) and gives it a client-generated `client_msg_id`.
2. App sends via WebSocket `message:send`. If offline, saved to local queue.
3. Server validates sender/recipient are contacts and not blocked, stores ciphertext, replies `message:ack` (✓ sent).
4. If recipient online: server pushes `message:new` over WebSocket. Otherwise: store as pending + send push notification.
5. Recipient app saves to local DB, sends `message:delivered` (✓✓).
6. When chat is opened, app sends `message:read` (blue ✓✓).
7. Server relays receipts to sender.

## Offline / sync strategy
- Local SQLite DB is source of truth for display.
- On reconnect, app calls `GET /sync?since=<cursor>` to fetch missed messages and receipts.
- Messages are deleted from server after delivery (server is relay, not archive) when E2EE is enabled.

## Media flow
1. App requests `POST /media/upload-url` → gets pre-signed S3 URL.
2. App encrypts file with random key, uploads ciphertext.
3. App sends message containing media ID + key (key itself is E2EE-encrypted in message).
4. Recipient downloads, decrypts locally.

## Live screen sharing flow
1. Viewer taps **Request to watch** → WebSocket `screen:request` → sharer's phone shows a prompt.
2. Sharer approves → OS permission dialog appears (Android MediaProjection / iOS ReplayKit).
3. Sharer app captures the screen and creates a WebRTC offer → `screen:offer` via the server.
4. Viewer replies with `screen:answer`; both exchange ICE candidates (`screen:ice`).
5. Video streams **peer-to-peer** (encrypted by WebRTC DTLS-SRTP). If a direct path is impossible (strict NAT/mobile carrier), traffic goes through the **coturn TURN relay** (still encrypted; the server cannot see the screen).
6. Either side taps **Stop** → `screen:end`; tracks are closed and the indicator disappears.

```
 Sharer phone ──(offer/ICE via WebSocket)──► Server ──► Viewer phone
 Sharer phone ◄════════ WebRTC video (P2P or via TURN) ════════► Viewer phone
```

### Platform notes
| Platform | How capture works | Limits |
|----------|-------------------|--------|
| Android | `MediaProjection` + foreground service (required) | Can share whole screen; system audio possible (Android 10+) |
| iOS | **ReplayKit Broadcast Upload Extension** for whole-screen; in-app capture otherwise | Extension has ~50 MB memory cap; user starts via system broadcast picker; no system audio |
| Viewer | Any platform, renders the incoming video track | None |

## Scaling notes
- Start with a single server (API + gateway) and managed Postgres.
- Scale WebSocket nodes horizontally using Redis pub/sub adapter.
- Move media to CDN-backed bucket as usage grows.

## Suggested folder structure
```
/backend
  /src
    /auth  /users  /contacts  /chats  /messages
    /media  /admin  /gateway
  docker-compose.yml
/mobile
  /lib
    /core  /features/{auth,contacts,chat,settings}
    /data/local (sqlite)  /data/remote (api, socket)
/docs
```
