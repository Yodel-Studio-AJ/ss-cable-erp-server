CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_ordered" double precision NOT NULL,
	"unit_price" double precision,
	"total_amount" double precision,
	"quantity_received" double precision DEFAULT 0 NOT NULL,
	"delivered_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_product_id_products_id_fk";
--> statement-breakpoint
DROP INDEX "po_product_idx";--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "poi_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "poi_product_idx" ON "purchase_order_items" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "quantity_ordered";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "unit_price";--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "total_amount";