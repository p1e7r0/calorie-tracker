ALTER TABLE "diary_entry" ADD COLUMN "fiber" real;--> statement-breakpoint
ALTER TABLE "diary_entry" ADD COLUMN "sugars" real;--> statement-breakpoint
ALTER TABLE "diary_entry" ADD COLUMN "saturated_fat" real;--> statement-breakpoint
ALTER TABLE "diary_entry" ADD COLUMN "salt" real;--> statement-breakpoint
UPDATE "diary_entry" AS "entry"
SET
  "fiber" = "food"."fiber" * "entry"."grams" / 100,
  "sugars" = "food"."sugars" * "entry"."grams" / 100,
  "saturated_fat" = "food"."saturated_fat" * "entry"."grams" / 100,
  "salt" = "food"."salt" * "entry"."grams" / 100
FROM "food"
WHERE "entry"."kind" = 'food' AND "entry"."food_id" = "food"."id" AND "entry"."grams" IS NOT NULL;
--> statement-breakpoint
WITH "recipe_totals" AS (
  SELECT
    "recipe"."id",
    "recipe"."servings",
    COALESCE("recipe"."cooked_weight_g", SUM("ingredient"."grams")) AS "final_weight",
    SUM("ingredient"."grams" * "food"."fiber" / 100) AS "fiber",
    SUM("ingredient"."grams" * "food"."sugars" / 100) AS "sugars",
    SUM("ingredient"."grams" * "food"."saturated_fat" / 100) AS "saturated_fat",
    SUM("ingredient"."grams" * "food"."salt" / 100) AS "salt"
  FROM "recipe"
  JOIN "recipe_ingredient" AS "ingredient" ON "ingredient"."recipe_id" = "recipe"."id"
  JOIN "food" ON "food"."id" = "ingredient"."food_id"
  GROUP BY "recipe"."id"
)
UPDATE "diary_entry" AS "entry"
SET
  "fiber" = "totals"."fiber" * (CASE WHEN "entry"."grams" IS NOT NULL THEN "entry"."grams" / NULLIF("totals"."final_weight", 0) ELSE COALESCE("entry"."servings", 1) / NULLIF("totals"."servings", 0) END),
  "sugars" = "totals"."sugars" * (CASE WHEN "entry"."grams" IS NOT NULL THEN "entry"."grams" / NULLIF("totals"."final_weight", 0) ELSE COALESCE("entry"."servings", 1) / NULLIF("totals"."servings", 0) END),
  "saturated_fat" = "totals"."saturated_fat" * (CASE WHEN "entry"."grams" IS NOT NULL THEN "entry"."grams" / NULLIF("totals"."final_weight", 0) ELSE COALESCE("entry"."servings", 1) / NULLIF("totals"."servings", 0) END),
  "salt" = "totals"."salt" * (CASE WHEN "entry"."grams" IS NOT NULL THEN "entry"."grams" / NULLIF("totals"."final_weight", 0) ELSE COALESCE("entry"."servings", 1) / NULLIF("totals"."servings", 0) END)
FROM "recipe_totals" AS "totals"
WHERE "entry"."kind" = 'recipe' AND "entry"."recipe_id" = "totals"."id";
