CREATE TYPE "public"."vendor_type" AS ENUM('manufacturer', 'distributor', 'wholesaler', 'trader');--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"created_by_user_id" uuid,
	"company_name" varchar(255) NOT NULL,
	"vendor_type" "vendor_type" DEFAULT 'trader' NOT NULL,
	"specialization" varchar(255),
	"gstin" varchar(20),
	"address" varchar(500),
	"city" varchar(100),
	"state" varchar(100),
	"pincode" varchar(10),
	"contact_name" varchar(255) NOT NULL,
	"contact_phone" varchar(20),
	"contact_email" varchar(255),
	"contact_designation" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_product_groups" (
	"vendor_id" uuid NOT NULL,
	"product_group_id" uuid NOT NULL,
	CONSTRAINT "vendor_product_groups_vendor_id_product_group_id_pk" PRIMARY KEY("vendor_id","product_group_id")
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_groups" ADD CONSTRAINT "vendor_product_groups_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_groups" ADD CONSTRAINT "vendor_product_groups_product_group_id_product_groups_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "public"."product_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendors_org_id_idx" ON "vendors" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "vendors_created_by_idx" ON "vendors" USING btree ("created_by_user_id");