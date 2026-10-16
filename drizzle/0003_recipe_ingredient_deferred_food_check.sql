ALTER TABLE "recipe_ingredient" DROP CONSTRAINT "recipe_ingredient_food_id_food_id_fk";
--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_food_id_food_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food"("id") ON DELETE no action ON UPDATE no action;