CREATE TYPE "public"."attribute_data_type" AS ENUM('string', 'number');--> statement-breakpoint
CREATE TABLE "attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit" varchar(50),
	"data_type" "attribute_data_type" DEFAULT 'number' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_group_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_group_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"formula_alias" varchar(50),
	"is_calculated" boolean DEFAULT false NOT NULL,
	"formula" text,
	"is_quantity_basis" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_group_attributes_product_group_id_attribute_id_unique" UNIQUE("product_group_id","attribute_id")
);
--> statement-breakpoint
ALTER TABLE "product_group_attributes" ADD CONSTRAINT "product_group_attributes_product_group_id_product_groups_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "public"."product_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_group_attributes" ADD CONSTRAINT "product_group_attributes_attribute_id_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pga_product_group_idx" ON "product_group_attributes" USING btree ("product_group_id");