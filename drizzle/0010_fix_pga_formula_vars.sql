ALTER TABLE "product_group_attributes" DROP CONSTRAINT IF EXISTS "product_group_attributes_source_input_pga_id_product_group_attr";--> statement-breakpoint
ALTER TABLE "product_group_attributes" DROP COLUMN IF EXISTS "source_input_pga_id";--> statement-breakpoint
ALTER TABLE "product_group_attributes" ADD COLUMN IF NOT EXISTS "formula_vars" jsonb;
