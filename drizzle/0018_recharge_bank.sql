CREATE TYPE "public"."recharge_outcome" AS ENUM('used', 'declined');--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "recharge_postponed_on" date;--> statement-breakpoint
ALTER TABLE "recharge_day" ADD COLUMN "outcome" "recharge_outcome" DEFAULT 'used' NOT NULL;--> statement-breakpoint
ALTER TABLE "recharge_day" ADD COLUMN "bonus_kcal" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "recharge_day" SET "bonus_kcal" = greatest(0, 2000 - "profile"."target_kcal") FROM "profile" WHERE "profile"."user_id" = "recharge_day"."user_id" AND "profile"."target_kcal" IS NOT NULL;
