# Invite & Secret Code System

Two separate mechanisms keep the app private.

## A. Registration Invite Code (who can create an account)
Prevents strangers who download the app from signing up.

### Flow
1. Owner (admin) generates an invite code in the admin panel or CLI: `ABCD-7KQ2-XM9P`.
2. Owner shares it privately with a friend.
3. Friend installs app → enters invite code + chooses username and password.
4. Server verifies code, creates account, marks code as used.

### Rules
- Format: 12 random chars, grouped (e.g. `XXXX-XXXX-XXXX`), generated with a cryptographically secure RNG.
- Store only a **hash** (SHA-256) of the code in the DB.
- Options per code: `single_use` (default), `max_uses`, `expires_at`.
- Rate limit attempts: 5 wrong codes per IP/device per hour, then lockout.
- Admin can revoke a code or a user at any time.
- **Bootstrap:** the first admin account is created using a code from an environment variable (`BOOTSTRAP_INVITE`) that is disabled after first use.

## B. Personal Contact Code (who can talk to whom)
Prevents anyone from messaging you unless you shared your code.

### Flow
1. Every user has a personal secret code, e.g. `K7M2-PX94`, and a matching QR.
2. Alice shares her code with Bob (in person, voice, any other channel).
3. Bob opens **Add Contact**, types the code (or scans QR).
4. Server finds Alice by code hash → creates a `contact_request` (Bob → Alice).
5. Alice gets a notification and **accepts or rejects**.
6. On accept, both appear in each other's contacts and a chat opens. Key exchange for E2EE happens here.

### Rules
- Codes are not tied to a phone number or username, so they cannot be guessed or searched.
- Code length: 8–10 random chars (~40+ bits) plus rate limiting. Use a 32-char alphabet without confusing chars (no 0/O, 1/I).
- Options on the code: **expires in X hours**, **one-time use**, or **permanent until regenerated**.
- "Regenerate code" invalidates the old one instantly (existing contacts stay).
- Max 10 failed lookups per user per hour.
- Rejected/blocked users cannot re-request with the same code.
- Server never reveals whether a code exists beyond "invalid or expired".

## API summary
| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | `{ inviteCode, username, password }` |
| `GET /me/contact-code` | Get my current code |
| `POST /me/contact-code/regenerate` | Rotate code |
| `POST /contacts/request` | `{ code }` |
| `POST /contacts/requests/:id/accept` | Accept |
| `POST /contacts/requests/:id/reject` | Reject |
| `POST /admin/invites` | Create registration invite |
| `DELETE /admin/invites/:id` | Revoke |

## Edge cases
- User tries to add themselves → reject.
- Already contacts → return existing chat.
- Code used by someone who is blocked by owner → generic error.
- Expired code → "Invalid or expired code".
