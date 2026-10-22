CREATE TABLE "cookware" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"weight_g" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cookware_weight_positive" CHECK ("cookware"."weight_g" > 0)
);
--> statement-breakpoint
ALTER TABLE "cookware" ADD CONSTRAINT "cookware_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cookware_user_index" ON "cookware" USING btree ("user_id");