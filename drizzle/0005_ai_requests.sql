CREATE TYPE "public"."ai_request_kind" AS ENUM('nutrition_label', 'meal_description');--> statement-breakpoint
CREATE TABLE "ai_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "ai_request_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_request" ADD CONSTRAINT "ai_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_request_user_created_index" ON "ai_request" USING btree ("user_id","created_at");