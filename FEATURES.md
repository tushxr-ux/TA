# Features Checklist (Private App for Two People - a Couple)

Legend: ✅ MVP | 🔜 Phase 2 | 🚀 Phase 3

## 1. Account & Onboarding
- ✅ Registration with invite code (see `INVITE_SYSTEM.md`)
- ✅ Login via username + password (or passkey / biometric)
- ✅ Profile: name, photo, about/bio
- 🔜 Optional phone/email verification (OTP)
- 🔜 Multi-device login (linked devices via QR)
- 🔜 Two-step verification (PIN)
- 🚀 Account deletion + data export

## 2. Contacts (Secret-Code Based)
- ✅ Personal secret code + QR code
- ✅ Add contact by entering code / scanning QR
- ✅ Accept / reject contact request
- ✅ Regenerate code (old code stops working)
- ✅ Block / unblock
- 🔜 Nicknames for contacts
- 🔜 Report user

## 3. One-to-One Chat
- ✅ Send/receive text in real time
- ✅ Message status: sent ✓, delivered ✓✓, read (blue) ✓✓
- ✅ Typing indicator
- ✅ Online / last seen
- ✅ Reply to a message (quote)
- ✅ Delete for me / delete for everyone
- ✅ Offline queue + retry
- 🔜 Edit message
- 🔜 Forward message
- 🔜 Star / bookmark message
- 🔜 Emoji reactions
- 🔜 Message search (in chat and global)
- 🔜 Link previews
- 🔜 Disappearing messages (24h / 7d / 90d)
- 🔜 View-once media
- 🚀 Pin messages
- 🚀 Scheduled messages

## 4. Media & Files
- ✅ Images (compressed, with caption)
- ✅ Voice notes (record, waveform, playback speed)
- 🔜 Video (compression, thumbnail)
- 🔜 Documents (PDF, DOCX, etc.)
- 🔜 Camera capture
- 🔜 Location sharing (static)
- 🔜 Contact card sharing
- 🔜 GIFs and stickers
- 🚀 Live location
- 🚀 Custom sticker packs
- 🚀 Media gallery per chat (media, links, docs)

## 5. Live Screen Sharing (Watch Together)
- 🔜 Start sharing your screen live with your partner (WebRTC)
- 🔜 Partner watches in real time, full screen or picture-in-picture
- 🔜 "Request to watch" button: partner asks, you must approve before anything is shared
- 🔜 Persistent on-screen indicator + notification while sharing ("You are sharing your screen")
- 🔜 One-tap stop sharing, by either side
- 🔜 Optional: share phone audio along with the screen (Android)
- 🔜 Quality control: auto-adjusts to network (low/medium/high)
- 🔜 Chat stays usable while watching (overlay or split view)
- 🚀 Watch-together mode with a voice channel
- 🚀 Remote pointer / draw on the shared screen
- 🚀 Sharing history log (who shared, when, how long; no recording)

## 6. Notifications
- ✅ Push notifications (FCM/APNs)
- ✅ Per-chat mute
- 🔜 Custom tones, vibration
- 🔜 In-app notification previews toggle
- 🔜 Quick reply from notification

## 7. Privacy & Security
- ✅ TLS everywhere
- 🔜 End-to-end encryption (Signal Protocol)
- 🔜 App lock (PIN / fingerprint / face)
- 🔜 Privacy settings: last seen, profile photo, about, read receipts
- 🚀 Security code verification between contacts

## 8. Chat Management
- ✅ Chat list with unread counts
- 🔜 Archive chats
- 🔜 Pin chats
- 🔜 Mark unread
- 🔜 Clear / delete chat
- 🔜 Export chat
- 🚀 Chat lock (hidden folder)
- 🚀 Chat wallpapers and themes

## 9. Settings & UX
- ✅ Dark / light theme
- 🔜 Font size
- 🔜 Language selection
- 🔜 Storage usage and auto-download rules

## 10. Admin / Server (for you as owner)
- ✅ Generate invite codes (single-use, expiry)
- ✅ Revoke users and codes
- 🔜 Admin dashboard (users, storage, reports)
- 🔜 Rate-limiting and abuse protection

## Design Decision: No Chat Backup
This app intentionally has **no chat backup or restore** (no cloud, no server copy).
- Chat history exists only on each user's device(s).
- Lost or reset phone = chat history is gone.
- Server deletes messages after delivery and keeps no archive.

## Scope Decisions
- **Two users only** (a couple). No groups, no voice/video calls, no status/stories.
- **Live screen sharing is included** (consent-based, see section 5).
- No screenshot blocking.
- No chat backup.
