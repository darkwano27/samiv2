-- Firma / sello guardados por usuario (SAP = worker_id) para PDFs (Sistemas, SO, etc.).
CREATE TABLE IF NOT EXISTS "worker_signatures" (
  "worker_id" text PRIMARY KEY NOT NULL,
  "drawn_base64" text,
  "uploaded_base64" text,
  "uploaded_mime" text,
  "preferred" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
