# Security & Privacy

## 1. Transport
- TLS 1.2+ for REST and WebSocket (Let's Encrypt).
- Optional: certificate pinning in the mobile app.

## 2. End-to-End Encryption (E2EE)
Use **libsignal** (Signal Protocol). Do not invent your own cryptography.

| Concept | Implementation |
|---------|----------------|
| Identity key | Long-term key pair per device, generated on install |
| Signed prekey + one-time prekeys | Uploaded to server for async session setup (X3DH) |
| Message encryption | Double Ratchet (forward secrecy) |
| Media | Random AES-256 key per file, key sent inside encrypted message |
| Key verification | Show safety number / QR so users can verify each other |

Server stores only ciphertext and cannot read messages.

## 3. Authentication
- Passwords: **Argon2id** hashing.
- JWT access tokens (15 min) + rotating refresh tokens (30 days), bound to device.
- Optional biometric / app-lock PIN on device.
- Optional 2FA PIN on re-registration.

## 4. Secret code security
- Generate with CSPRNG; store only hashes.
- Rate limit by IP, device, and account.
- Generic errors; no user enumeration.
- Allow expiry and rotation.

## 4b. Screen sharing safety
- **Consent first:** nothing is shared until the sharer approves and accepts the OS capture prompt.
- **Always visible:** persistent notification and on-screen indicator while sharing; one-tap stop.
- **Encrypted:** WebRTC DTLS-SRTP; TURN relay only forwards encrypted packets.
- **No recording:** the app does not record or store the stream; the server logs metadata only.
- **Sensitive screens:** warn before sharing (banking, passwords, OTPs); optional auto-hide of notifications during sharing.
- **TURN credentials:** short-lived (e.g. 10 min), generated per session; restrict TURN to authenticated users.

## 5. Data on device
- Local DB encrypted with SQLCipher; key in Android Keystore / iOS Keychain.
- Wipe data on logout.

## 6. Server hardening
- Input validation on all endpoints (class-validator / zod).
- Max message size, media size, and MIME allow-list.
- Rate limits on message sending to stop spam/abuse.
- Pre-signed URLs expire in minutes; buckets are private.
- Secrets in env/secret manager, never in git.
- Back up only server account data (users, codes, contacts) if you wish; chat history is never backed up.
- Dependency scanning (`npm audit`, Dependabot).

## 7. Threat model (quick view)
| Threat | Mitigation |
|--------|------------|
| Stranger signs up | Invite codes, revoke |
| Stranger messages you | Secret contact code + accept step |
| Code brute-force | Long random codes, rate limit, lockout |
| Server compromise reading chats | E2EE |
| Stolen phone | App lock, remote logout, encrypted local DB |
| Spam / abuse | Block, report, admin disable, rate limits |
| Token theft | Short-lived JWT, refresh rotation, device binding |

## 8. Privacy
- No contact-book upload, no phone-number discovery.
- Collect minimal metadata; purge delivered ciphertext after N days.
- Provide account deletion and data export.
- If you invite others, tell them what is stored.
