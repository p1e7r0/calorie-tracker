CREATE TABLE "freezer_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" "diary_entry_kind" NOT NULL,
	"food_id" uuid,
	"recipe_id" uuid,
	"label" text NOT NULL,
	"grams" real,
	"servings" real,
	"kcal" real NOT NULL,
	"protein" real DEFAULT 0 NOT NULL,
	"carbs" real DEFAULT 0 NOT NULL,
	"fat" real DEFAULT 0 NOT NULL,
	"fiber" real,
	"sugars" real,
	"saturated_fat" real,
	"salt" real,
	"portions" integer NOT NULL,
	"portions_left" integer NOT NULL,
	"frozen_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freezer_batch_kind" CHECK ("freezer_batch"."kind" <> 'quick'),
	CONSTRAINT "freezer_batch_portions_left" CHECK ("freezer_batch"."portions_left" >= 0 and "freezer_batch"."portions_left" <= "freezer_batch"."portions")
);
--> statement-breakpoint
ALTER TABLE "diary_entry" ADD COLUMN "freezer_batch_id" uuid;--> statement-breakpoint
ALTER TABLE "freezer_batch" ADD CONSTRAINT "freezer_batch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezer_batch" ADD CONSTRAINT "freezer_batch_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freezer_batch" ADD CONSTRAINT "freezer_batch_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "freezer_batch_user_index" ON "freezer_batch" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "diary_entry" ADD CONSTRAINT "diary_entry_freezer_batch_id_freezer_batch_id_fk" FOREIGN KEY ("freezer_batch_id") REFERENCES "public"."freezer_batch"("id") ON DELETE set null ON UPDATE no action;