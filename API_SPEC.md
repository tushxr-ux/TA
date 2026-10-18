# API Specification

Base URL: `https://your-domain.com/api/v1` | Auth: `Authorization: Bearer <JWT>`

## Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/register` | `inviteCode, username, displayName, password, deviceInfo, publicKeys` | Requires valid invite |
| POST | `/auth/login` | `username, password, deviceInfo` | Returns access + refresh token |
| POST | `/auth/refresh` | `refreshToken` | |
| POST | `/auth/logout` | | Revokes device token |

## Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | My profile |
| PATCH | `/me` | Update name, about |
| POST | `/me/avatar` | Upload avatar |
| GET/PATCH | `/me/privacy` | Privacy settings |
| GET | `/me/contact-code` | Current code |
| POST | `/me/contact-code/regenerate` | Rotate |

## Contacts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/contacts/request` | `{ code }` |
| GET | `/contacts/requests` | Incoming/outgoing |
| POST | `/contacts/requests/:id/accept` | |
| POST | `/contacts/requests/:id/reject` | |
| GET | `/contacts` | List |
| POST | `/contacts/:id/block` / `unblock` | |
| DELETE | `/contacts/:id` | Remove |

## Conversations & Messages
| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | Chat list with last message + unread |
| PATCH | `/conversations/:id` | Rename, icon, settings |
| GET | `/conversations/:id/messages?before=&limit=` | History page |
| DELETE | `/messages/:id?scope=me\|all` | Delete |
| PATCH | `/messages/:id` | Edit |
| POST | `/messages/:id/reactions` | `{ emoji }` |
| POST | `/messages/:id/star` | |
| GET | `/search?q=` | Search local-decrypted index (client-side with E2EE) |
| GET | `/sync?since=` | Missed events |

## Media
| Method | Path | Description |
|--------|------|-------------|
| POST | `/media/upload-url` | `{ mime, size }` → pre-signed URL |
| GET | `/media/:id/download-url` | Pre-signed download |

## Screen Sharing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/screen/ice-servers` | Short-lived STUN/TURN credentials |
| GET | `/screen/history` | Log of past sessions (metadata only) |

## E2EE Keys
| Method | Path | Description |
|--------|------|-------------|
| POST | `/keys/prekeys` | Upload one-time prekeys |
| GET | `/keys/:userId/bundle` | Fetch prekey bundle to start session |

## Admin
| Method | Path |
|--------|------|
| POST | `/admin/invites` |
| GET | `/admin/invites` |
| DELETE | `/admin/invites/:id` |
| GET | `/admin/users` |
| POST | `/admin/users/:id/disable` |

---

## WebSocket Events
Connect: `wss://your-domain.com/ws?token=<JWT>`

### Client → Server
| Event | Payload |
|-------|---------|
| `message:send` | `{ conversationId, clientMsgId, type, body, mediaId?, replyTo? }` |
| `message:delivered` | `{ messageId }` |
| `message:read` | `{ conversationId, upToMessageId }` |
| `typing:start` / `typing:stop` | `{ conversationId }` |
| `presence:update` | `{ online }` |
| `screen:request` | `{ sessionId }` viewer asks to watch |
| `screen:accept` / `screen:decline` | `{ sessionId }` sharer's answer |
| `screen:offer` | `{ sessionId, sdp }` |
| `screen:answer` | `{ sessionId, sdp }` |
| `screen:ice` | `{ sessionId, candidate }` |
| `screen:end` | `{ sessionId }` either side |

### Server → Client
| Event | Payload |
|-------|---------|
| `message:ack` | `{ clientMsgId, messageId, createdAt }` |
| `message:new` | full message |
| `message:status` | `{ messageId, userId, status }` |
| `message:deleted` / `message:edited` | |
| `typing` | `{ conversationId, userId, isTyping }` |
| `presence` | `{ userId, online, lastSeen }` |
| `contact:request` / `contact:accepted` | |
| `screen:requested` | `{ sessionId, from }` |
| `screen:accepted` / `screen:declined` | `{ sessionId }` |
| `screen:signal` | `{ type: offer\|answer\|ice, data }` |
| `screen:ended` | `{ sessionId, reason }` |

## Error format
```json
{ "error": { "code": "INVALID_CODE", "message": "Invalid or expired code" } }
```
