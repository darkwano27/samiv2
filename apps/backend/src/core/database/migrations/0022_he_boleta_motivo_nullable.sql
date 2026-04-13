ALTER TABLE "he_boleta_headers" ALTER COLUMN "motivo_code" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "he_boleta_lines" ALTER COLUMN "motivo_code" DROP NOT NULL;
