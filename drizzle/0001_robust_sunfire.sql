CREATE TYPE "public"."material_type" AS ENUM('metal', 'pvc', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."product_group_type" AS ENUM('raw_material', 'intermediate', 'finished_goods', 'processed_product');--> statement-breakpoint
CREATE TABLE "product_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "product_group_type" NOT NULL,
	"is_procured" boolean NOT NULL,
	"material_type" "material_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_groups_name_unique" UNIQUE("name")
);
