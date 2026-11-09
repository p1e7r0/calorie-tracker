ALTER TABLE "recipe_ingredient" ALTER COLUMN "food_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD COLUMN "sub_recipe_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_sub_recipe_id_recipe_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_ingredient_sub_recipe_index" ON "recipe_ingredient" USING btree ("sub_recipe_id");--> statement-breakpoint
ALTER TABLE "recipe_ingredient" ADD CONSTRAINT "recipe_ingredient_food_or_recipe" CHECK (("recipe_ingredient"."food_id" is null) <> ("recipe_ingredient"."sub_recipe_id" is null));