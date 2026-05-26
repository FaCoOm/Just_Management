-- Migration: pipeline_connectors
-- Adds connector durability tables for ingestion pipeline:
--   - integration_connections: persisted withone connection metadata per user
--   - watched_files:           folder-watcher fingerprints + replay prevention
--   - email_import_messages:   email connector message idempotency
--   - seed_batches:            built-in seeder run history
--
-- Additive only. No edits to existing models.
-- Pattern: matches 20260502000000_init_track_b/migration.sql conventions.

-- CreateTable: integration_connections
CREATE TABLE "integration_connections" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        TEXT         NOT NULL,
  "identity_type"  TEXT         NOT NULL DEFAULT 'user',
  "platform"       TEXT         NOT NULL,
  "connection_key" TEXT         NOT NULL,
  "display_name"   TEXT,
  "environment"    TEXT         NOT NULL DEFAULT 'live',
  "status"         TEXT         NOT NULL DEFAULT 'active',
  "last_used_at"   TIMESTAMPTZ(6),
  "last_error"     TEXT,
  "metadata"       JSONB        NOT NULL DEFAULT '{}',
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_connection_key_key"
  ON "integration_connections" ("connection_key");
CREATE INDEX "integration_connections_user_id_platform_idx"
  ON "integration_connections" ("user_id", "platform");
CREATE INDEX "integration_connections_status_idx"
  ON "integration_connections" ("status");

-- CreateTable: watched_files
CREATE TABLE "watched_files" (
  "id"                 UUID         NOT NULL DEFAULT gen_random_uuid(),
  "watch_dir"          TEXT         NOT NULL,
  "relative_path"      TEXT         NOT NULL,
  "size_bytes"         BIGINT       NOT NULL,
  "mtime"              TIMESTAMPTZ(6) NOT NULL,
  "content_sha256"     TEXT         NOT NULL,
  "last_seen_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "last_processed_at"  TIMESTAMPTZ(6),
  "last_sync_run_id"   UUID,
  "status"             TEXT         NOT NULL DEFAULT 'seen',
  "failure_reason"     TEXT,

  CONSTRAINT "watched_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "watched_files_watch_dir_relative_path_content_sha256_key"
  ON "watched_files" ("watch_dir", "relative_path", "content_sha256");
CREATE INDEX "watched_files_status_idx"
  ON "watched_files" ("status");

-- CreateTable: email_import_messages
CREATE TABLE "email_import_messages" (
  "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
  "connection_key"       TEXT         NOT NULL,
  "provider"             TEXT         NOT NULL DEFAULT 'gmail',
  "provider_message_id"  TEXT         NOT NULL,
  "thread_id"            TEXT,
  "internal_date"        TIMESTAMPTZ(6),
  "subject"              TEXT,
  "from_address"         TEXT,
  "attachment_filename"  TEXT,
  "attachment_size"      BIGINT,
  "attachment_sha256"    TEXT,
  "status"               TEXT         NOT NULL DEFAULT 'seen',
  "last_sync_run_id"     UUID,
  "failure_reason"       TEXT,
  "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

  CONSTRAINT "email_import_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_import_messages_connection_key_message_id_sha_key"
  ON "email_import_messages" ("connection_key", "provider_message_id", "attachment_sha256");
CREATE INDEX "email_import_messages_status_idx"
  ON "email_import_messages" ("status");

-- CreateTable: seed_batches
CREATE TABLE "seed_batches" (
  "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
  "source_dir"       TEXT         NOT NULL,
  "manifest_sha256"  TEXT         NOT NULL,
  "status"           TEXT         NOT NULL DEFAULT 'started',
  "sync_run_id"      UUID,
  "started_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "finished_at"      TIMESTAMPTZ(6),
  "notes"            TEXT,

  CONSTRAINT "seed_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seed_batches_source_dir_status_idx"
  ON "seed_batches" ("source_dir", "status");

-- Triggers: BEFORE UPDATE set_updated_at_timestamp
-- Pattern matches existing 20260502000000_init_track_b/migration.sql usage.
DROP TRIGGER IF EXISTS integration_connections_set_updated_at ON "integration_connections";
CREATE TRIGGER integration_connections_set_updated_at
  BEFORE UPDATE ON "integration_connections"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS email_import_messages_set_updated_at ON "email_import_messages";
CREATE TRIGGER email_import_messages_set_updated_at
  BEFORE UPDATE ON "email_import_messages"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();
