CREATE TABLE "product_variant_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_product_id" uuid NOT NULL,
	"product_group_input_id" uuid NOT NULL,
	"input_product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvi_unique" UNIQUE("output_product_id","product_group_input_id")
);
--> statement-breakpoint
ALTER TABLE "product_variant_inputs" ADD CONSTRAINT "product_variant_inputs_output_product_id_products_id_fk" FOREIGN KEY ("output_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_inputs" ADD CONSTRAINT "product_variant_inputs_product_group_input_id_product_group_inputs_id_fk" FOREIGN KEY ("product_group_input_id") REFERENCES "public"."product_group_inputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_inputs" ADD CONSTRAINT "product_variant_inputs_input_product_id_products_id_fk" FOREIGN KEY ("input_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;