import { parseArgs } from "node:util";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { MongoClient, type Document } from "mongodb";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { mapLegacyFood, mapLegacyMeasurement, type LegacyFood } from "./legacy-mapping";

const { values: options } = parseArgs({
  options: {
    "owner-email": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "global-only": { type: "boolean", default: false },
  },
});

const ownerEmail = options["owner-email"];
const dryRun = options["dry-run"] ?? false;
const globalOnly = options["global-only"] ?? false;
const legacyUri = process.env.LEGACY_MONGODB_URI;
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if ((!ownerEmail && !globalOnly) || !legacyUri || !databaseUrl) {
  console.error(
    "Usage: pnpm migrate:legacy (--owner-email <email> | --global-only) [--dry-run]\n" +
      "Requires LEGACY_MONGODB_URI and DATABASE_URL in the environment.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const database = drizzle({ client: pool, schema, casing: "snake_case" });
const mongoClient = new MongoClient(legacyUri);

async function findOwner() {
  if (globalOnly) return { id: "" };
  const [owner] = await database
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, ownerEmail!));
  if (!owner) {
    throw new Error(`No user with email ${ownerEmail}. Register the account first, then rerun.`);
  }
  return owner;
}

async function main() {
  const owner = await findOwner();

  await mongoClient.connect();
  const legacyDatabase = mongoClient.db();
  const legacyFoods = (await legacyDatabase.collection("foods").find().toArray()) as unknown as LegacyFood[];
  const legacyRecipes = await legacyDatabase.collection("meals").find({ type: "recipe" }).toArray();
  const legacyMeasurements = await legacyDatabase.collection("measurements").find().toArray();

  const mappedFoods = legacyFoods.map((legacyFood) => mapLegacyFood(legacyFood, owner.id));
  const legacyFoodIds = new Set(legacyFoods.map((legacyFood) => String(legacyFood._id)));
  const missingRecipeFoods = new Map<string, LegacyFood>();
  for (const legacyRecipe of legacyRecipes) {
    for (const row of (legacyRecipe.rows ?? []) as Document[]) {
      const embeddedFood = row.food as LegacyFood | undefined;
      const legacyId = embeddedFood ? String(embeddedFood._id) : undefined;
      if (embeddedFood && legacyId && !legacyFoodIds.has(legacyId)) {
        missingRecipeFoods.set(legacyId, embeddedFood);
      }
    }
  }
  for (const embeddedFood of missingRecipeFoods.values()) {
    mappedFoods.push(mapLegacyFood({ ...embeddedFood, id: null }, owner.id));
  }

  const globalFoods = mappedFoods.filter((mapped) => mapped.values.ownerId === null);
  const ownedFoods = mappedFoods.filter((mapped) => mapped.values.ownerId !== null);
  console.log(
    `Legacy data: ${globalFoods.length} dataset foods, ${ownedFoods.length} personal foods ` +
      `(${missingRecipeFoods.size} recovered from recipes), ${legacyRecipes.length} recipes, ` +
      `${legacyMeasurements.length} measurements.`,
  );

  if (dryRun) {
    console.log("Dry run: nothing written.");
    return;
  }

  const legacyToFoodId = new Map<string, string>();
  if (globalOnly) {
    for (const batch of chunk(globalFoods, 200)) {
      await database.insert(schema.food).values(batch.map((mapped) => mapped.values)).onConflictDoNothing();
    }
    console.log(`Imported the shared catalog (${globalFoods.length} dataset foods). Personal data skipped.`);
    return;
  }

  for (const batch of chunk(globalFoods, 200)) {
    const inserted = await database
      .insert(schema.food)
      .values(batch.map((mapped) => mapped.values))
      .onConflictDoNothing()
      .returning({ id: schema.food.id, sourceReference: schema.food.sourceReference });
    console.log(`Inserted ${inserted.length} dataset foods.`);
  }
  const datasetRows = await database
    .select({ id: schema.food.id, sourceReference: schema.food.sourceReference })
    .from(schema.food)
    .where(and(eq(schema.food.source, "swiss"), isNull(schema.food.ownerId)));
  const datasetIdByReference = new Map(datasetRows.map((row) => [row.sourceReference, row.id]));
  for (const mapped of globalFoods) {
    const foodId = datasetIdByReference.get(mapped.values.sourceReference);
    if (foodId) legacyToFoodId.set(mapped.legacyId, foodId);
  }

  const existingOwned = await database
    .select({ id: schema.food.id, sourceReference: schema.food.sourceReference })
    .from(schema.food)
    .where(eq(schema.food.ownerId, owner.id));
  const ownedIdByReference = new Map(existingOwned.map((row) => [row.sourceReference, row.id]));
  const ownedToInsert = ownedFoods.filter((mapped) => !ownedIdByReference.has(mapped.values.sourceReference));
  for (const batch of chunk(ownedToInsert, 200)) {
    const inserted = await database
      .insert(schema.food)
      .values(batch.map((mapped) => mapped.values))
      .returning({ id: schema.food.id, sourceReference: schema.food.sourceReference });
    for (const row of inserted) ownedIdByReference.set(row.sourceReference, row.id);
  }
  console.log(`Inserted ${ownedToInsert.length} personal foods.`);
  for (const mapped of ownedFoods) {
    const foodId = ownedIdByReference.get(mapped.values.sourceReference);
    if (foodId) legacyToFoodId.set(mapped.legacyId, foodId);
  }

  const favoriteFoodIds = mappedFoods
    .filter((mapped) => mapped.isFavorite)
    .map((mapped) => legacyToFoodId.get(mapped.legacyId))
    .filter((foodId): foodId is string => Boolean(foodId));
  if (favoriteFoodIds.length > 0) {
    await database
      .insert(schema.favoriteFood)
      .values(favoriteFoodIds.map((foodId) => ({ userId: owner.id, foodId })))
      .onConflictDoNothing();
  }
  console.log(`Marked ${favoriteFoodIds.length} favorites.`);

  const existingRecipes = await database
    .select({ name: schema.recipe.name })
    .from(schema.recipe)
    .where(eq(schema.recipe.ownerId, owner.id));
  const existingRecipeNames = new Set(existingRecipes.map((row) => row.name));
  let insertedRecipes = 0;
  for (const legacyRecipe of legacyRecipes) {
    const name = String(legacyRecipe.name ?? "Ricetta").trim();
    if (existingRecipeNames.has(name)) continue;
    const ingredients = ((legacyRecipe.rows ?? []) as Document[])
      .map((row, position) => ({
        foodId: legacyToFoodId.get(String((row.food as LegacyFood | undefined)?._id ?? row.id)),
        grams: Number(row.quantity),
        position,
      }))
      .filter(
        (ingredient): ingredient is { foodId: string; grams: number; position: number } =>
          Boolean(ingredient.foodId) && Number.isFinite(ingredient.grams) && ingredient.grams > 0,
      );
    await database.transaction(async (transaction) => {
      const [createdRecipe] = await transaction
        .insert(schema.recipe)
        .values({ ownerId: owner.id, name, servings: 1 })
        .returning({ id: schema.recipe.id });
      if (ingredients.length > 0) {
        await transaction
          .insert(schema.recipeIngredient)
          .values(ingredients.map((ingredient) => ({ ...ingredient, recipeId: createdRecipe.id })));
      }
    });
    insertedRecipes += 1;
  }
  console.log(`Inserted ${insertedRecipes} recipes.`);

  const mappedMeasurements = legacyMeasurements
    .map((legacyMeasurement) => mapLegacyMeasurement(legacyMeasurement, owner.id))
    .filter((measurement) => measurement !== null);
  const existingMeasurementDays = new Set(
    (
      await database
        .select({ measuredOn: schema.measurement.measuredOn })
        .from(schema.measurement)
        .where(
          and(
            eq(schema.measurement.userId, owner.id),
            inArray(
              schema.measurement.measuredOn,
              mappedMeasurements.map((measurement) => measurement.measuredOn).concat("0001-01-01"),
            ),
          ),
        )
    ).map((row) => row.measuredOn),
  );
  const measurementsToInsert = mappedMeasurements.filter(
    (measurement) => !existingMeasurementDays.has(measurement.measuredOn),
  );
  if (measurementsToInsert.length > 0) {
    await database.insert(schema.measurement).values(measurementsToInsert);
  }
  console.log(`Inserted ${measurementsToInsert.length} measurements.`);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoClient.close();
    await pool.end();
  });
