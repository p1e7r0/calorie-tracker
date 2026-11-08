CREATE TYPE "public"."coach_level" AS ENUM('normal', 'fierce', 'jackpot', 'silence');--> statement-breakpoint
CREATE TYPE "public"."coach_message_kind" AS ENUM('notification', 'weigh_in', 'weekly_report');--> statement-breakpoint
CREATE TABLE "coach_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "coach_message_kind" NOT NULL,
	"day" date NOT NULL,
	"slot" text,
	"level" "coach_level" NOT NULL,
	"event_keys" text[] DEFAULT '{}'::text[] NOT NULL,
	"text" text,
	"sent" boolean DEFAULT false NOT NULL,
	"arrival_day" date,
	"input" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recharge_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recharge_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "coach_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coach_message" ADD CONSTRAINT "coach_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharge_day" ADD CONSTRAINT "recharge_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_message_user_day_index" ON "coach_message" USING btree ("user_id","day");