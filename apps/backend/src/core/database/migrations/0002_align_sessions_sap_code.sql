ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_worker_id_workers_id_fk";
ALTER TABLE "sessions" RENAME COLUMN "worker_id" TO "sap_code";
