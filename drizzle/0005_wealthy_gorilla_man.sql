CREATE TABLE "vendor_branches" (
	"vendor_id" uuid NOT NULL,
	"sub_company_id" uuid NOT NULL,
	CONSTRAINT "vendor_branches_vendor_id_sub_company_id_pk" PRIMARY KEY("vendor_id","sub_company_id")
);
--> statement-breakpoint
ALTER TABLE "vendor_branches" ADD CONSTRAINT "vendor_branches_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_branches" ADD CONSTRAINT "vendor_branches_sub_company_id_sub_companies_id_fk" FOREIGN KEY ("sub_company_id") REFERENCES "public"."sub_companies"("id") ON DELETE cascade ON UPDATE no action;