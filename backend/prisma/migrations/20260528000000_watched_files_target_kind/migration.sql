-- Add target_kind column and composite index to watched_files
ALTER TABLE "watched_files" ADD COLUMN "target_kind" TEXT NOT NULL DEFAULT 'unknown';
CREATE INDEX "watched_files_target_kind_idx" ON "watched_files"("watch_dir", "target_kind", "status", "last_seen_at");
