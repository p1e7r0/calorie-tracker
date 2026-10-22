CREATE TYPE "public"."storage_location" AS ENUM('fridge', 'freezer');--> statement-breakpoint
CREATE TABLE "prepared_meal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"location" "storage_location" NOT NULL,
	"portions" integer NOT NULL,
	"stored_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prepared_meal_portions_non_negative" CHECK ("prepared_meal"."portions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "prepared_meal_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prepared_meal_id" uuid NOT NULL,
	"kind" "diary_entry_kind" NOT NULL,
	"food_id" uuid,
	"recipe_id" uuid,
	"label" text NOT NULL,
	"grams" real,
	"servings" real,
	"portion_label" text,
	"kcal" real NOT NULL,
	"protein" real DEFAULT 0 NOT NULL,
	"carbs" real DEFAULT 0 NOT NULL,
	"fat" real DEFAULT 0 NOT NULL,
	"fiber" real,
	"sugars" real,
	"saturated_fat" real,
	"salt" real,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "prepared_meal_item_kind" CHECK ("prepared_meal_item"."kind" in ('food', 'recipe'))
);
--> statement-breakpoint
ALTER TABLE "prepared_meal" ADD CONSTRAINT "prepared_meal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_meal_item" ADD CONSTRAINT "prepared_meal_item_prepared_meal_id_prepared_meal_id_fk" FOREIGN KEY ("prepared_meal_id") REFERENCES "public"."prepared_meal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_meal_item" ADD CONSTRAINT "prepared_meal_item_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepared_meal_item" ADD CONSTRAINT "prepared_meal_item_recipe_id_recipe_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipe"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prepared_meal_user_index" ON "prepared_meal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "prepared_meal_item_prepared_meal_index" ON "prepared_meal_item" USING btree ("prepared_meal_id");