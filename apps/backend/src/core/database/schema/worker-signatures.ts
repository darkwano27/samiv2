import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Firma dibujada y/o imagen subida (sello) por trabajador; `preferred` elige cuál usar en PDFs. */
export const workerSignatures = pgTable('worker_signatures', {
  workerId: text('worker_id').primaryKey(),
  drawnBase64: text('drawn_base64'),
  uploadedBase64: text('uploaded_base64'),
  uploadedMime: text('uploaded_mime'),
  preferred: text('preferred'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
