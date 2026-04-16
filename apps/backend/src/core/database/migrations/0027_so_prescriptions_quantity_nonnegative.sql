ALTER TABLE "so_prescriptions" DROP CONSTRAINT IF EXISTS "so_prescriptions_quantity_check";
ALTER TABLE "so_prescriptions" ADD CONSTRAINT "so_prescriptions_quantity_check" CHECK ("quantity" >= 0);
