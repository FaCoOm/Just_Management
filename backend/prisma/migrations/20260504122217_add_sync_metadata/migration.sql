-- CreateTable
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_account" TEXT,
    "endpoint" TEXT NOT NULL,
    "is_dry_run" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'started',
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "dead_letter_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "config_snapshot" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_dead_letters" (
    "id" UUID NOT NULL,
    "sync_run_id" UUID NOT NULL,
    "source_file" TEXT,
    "source_row_number" INTEGER,
    "failure_code" TEXT NOT NULL,
    "failure_reason" TEXT NOT NULL,
    "normalized_payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_dead_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_dead_letters_sync_run_id_idx" ON "sync_dead_letters"("sync_run_id");

-- CreateIndex
CREATE INDEX "sync_dead_letters_source_file_source_row_number_idx" ON "sync_dead_letters"("source_file", "source_row_number");

-- AddForeignKey
ALTER TABLE "sync_dead_letters" ADD CONSTRAINT "sync_dead_letters_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
