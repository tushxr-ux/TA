# Database Schema (PostgreSQL)

```sql
-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  about TEXT DEFAULT 'Hey there! I am using this app.',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DEVICES (multi-device + push + E2EE keys)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT,
  push_token TEXT,
  identity_public_key TEXT,
  signed_prekey TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE one_time_prekeys (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL
);

-- INVITES (registration)
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  max_uses INT DEFAULT 1,
  used_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PERSONAL CONTACT CODES
CREATE TABLE contact_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  single_use BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CONTACTS
CREATE TABLE contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID REFERENCES users(id),
  to_user UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (from_user, to_user)
);

CREATE TABLE contacts (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT,
  blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, contact_id)
);

-- CONVERSATIONS (one private chat between the two partners)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('direct')) NOT NULL,
  created_by UUID REFERENCES users(id),
  disappearing_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ,
  archived BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  last_read_message_id UUID,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- MESSAGES (content is ciphertext when E2EE is on)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  client_msg_id TEXT NOT NULL,
  type TEXT CHECK (type IN ('text','image','video','audio','document','location','contact','sticker','system')),
  body BYTEA,
  media_id UUID,
  reply_to UUID REFERENCES messages(id),
  forwarded BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  deleted_for_all BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sender_id, client_msg_id)
);
CREATE INDEX idx_messages_conv_time ON messages (conversation_id, created_at DESC);

CREATE TABLE message_receipts (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE message_reactions (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE starred_messages (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, message_id)
);

-- MEDIA
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  thumbnail_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SCREEN SHARE SESSIONS (metadata only; never stores video)
CREATE TABLE screen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_id UUID REFERENCES users(id),
  viewer_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('requested','active','declined','ended')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- PRIVACY SETTINGS
CREATE TABLE privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen TEXT DEFAULT 'contacts',
  profile_photo TEXT DEFAULT 'contacts',
  about TEXT DEFAULT 'contacts',
  read_receipts BOOLEAN DEFAULT TRUE
);
```

## Redis keys
| Key | Use |
|-----|-----|
| `presence:{userId}` | Online flag with TTL |
| `typing:{convId}:{userId}` | Typing indicator (5s TTL) |
| `ratelimit:{ip}:{action}` | Rate limits |
| `socket:{userId}` | Active socket node IDs |
