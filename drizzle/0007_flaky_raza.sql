CREATE TABLE "product_group_inputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_group_id" uuid NOT NULL,
	"input_group_id" uuid NOT NULL,
	"qty_formula" text NOT NULL,
	"yield_factor" numeric(7, 4) DEFAULT '1.0' NOT NULL,
	"label" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_group_inputs" ADD CONSTRAINT "product_group_inputs_output_group_id_product_groups_id_fk" FOREIGN KEY ("output_group_id") REFERENCES "public"."product_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_group_inputs" ADD CONSTRAINT "product_group_inputs_input_group_id_product_groups_id_fk" FOREIGN KEY ("input_group_id") REFERENCES "public"."product_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pgi_output_group_idx" ON "product_group_inputs" USING btree ("output_group_id");--> statement-breakpoint
CREATE INDEX "pgi_input_group_idx" ON "product_group_inputs" USING btree ("input_group_id");