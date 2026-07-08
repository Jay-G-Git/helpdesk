-- Messaging: threading, reactions, attachments, edit, delete, pin

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS parent_id    bigint REFERENCES chat_messages(id),
  ADD COLUMN IF NOT EXISTS edited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS is_deleted  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned   boolean NOT NULL DEFAULT false;

-- Reactions (thumbs_up | check | heart | plus_one)
CREATE TABLE IF NOT EXISTS message_reactions (
  id          bigserial PRIMARY KEY,
  message_id  bigint NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  business_id text NOT NULL,
  user_id     uuid NOT NULL,
  sender_name text NOT NULL,
  reaction    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, reaction)
);

-- Attachments (files uploaded via Supabase storage)
CREATE TABLE IF NOT EXISTS message_attachments (
  id           bigserial PRIMARY KEY,
  message_id   bigint NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  business_id  text NOT NULL,
  file_name    text NOT NULL,
  file_type    text NOT NULL,
  file_size    bigint NOT NULL,
  storage_path text NOT NULL,
  url          text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON chat_messages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_biz ON message_reactions(business_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON message_attachments(message_id);
