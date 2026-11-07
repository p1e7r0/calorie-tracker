import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { hashPassword } from "better-auth/crypto";
import { and, count, inArray, isNull, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { addDays, todayIsoDate } from "../src/lib/nutrition/days";
import { ageOn, computeDailyTargets } from "../src/lib/nutrition/goals";
import { weekStart } from "../src/lib/nutrition/weeks";
import {
  catalogFoods,
  type CatalogFood,
  cookware,
  diaryPlan,
  emptyProfile,
  entrySnapshot,
  favoriteFoodSlugs,
  fullProfile,
  incompleteDayOffset,
  isLocalDatabaseHost,
  personalFoods,
  type ProfileSeed,
  recipes,
  savedMeals,
  storedMeals,
  uxSeedReferencePrefix,
  uxUsers,
  weighIns,
} from "./ux-seed-data";

const { values: options } = parseArgs({
  options: {
    "allow-remote": { type: "boolean", default: false },
  },
});

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const password = process.env.UX_PASSWORD ?? "password-sicura";

if (!databaseUrl) {
  console.error("Usage: pnpm seed:ux [--allow-remote]\nRequires DATABASE_URL in the environment.");
  process.exit(1);
}

const hostname = new URL(databaseUrl).hostname;
if (process.env.NODE_ENV === "production" || (!isLocalDatabaseHost(hostname) && !options["allow-remote"])) {
  console.error(
    `Refusing to seed ${hostname}: the UX seed resets its users and adds catalog foods.\n` +
      "Use a local database, or pass --allow-remote for a dedicated non-production branch.",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl, max: 2 });
const database = drizzle({ client: pool, schema, casing: "snake_case" });
type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

function foodValues(food: CatalogFood) {
  return {
    name: food.name,
    category: food.category,
    unit: food.unit ?? ("g" as const),
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sugars: food.sugars,
    saturatedFat: food.saturatedFat,
    salt: food.salt,
  };
}

async function insertPortions(transaction: Transaction, foodId: string, food: CatalogFood) {
  if (!food.portions?.length) return;
  await transaction
    .insert(schema.foodPortion)
    .values(food.portions.map((portion, position) => ({ foodId, ...portion, position })));
}

async function ensureCatalog(transaction: Transaction) {
  const references = catalogFoods.map((food) => uxSeedReferencePrefix + food.slug);
  const existing = await transaction
    .select({ id: schema.food.id, sourceReference: schema.food.sourceReference })
    .from(schema.food)
    .where(and(isNull(schema.food.ownerId), inArray(schema.food.sourceReference, references)));
  const ids = new Map(existing.map((row) => [row.sourceReference!, row.id]));
  for (const food of catalogFoods) {
    const reference = uxSeedReferencePrefix + food.slug;
    if (ids.has(reference)) continue;
    const [created] = await transaction
      .insert(schema.food)
      .values({ ...foodValues(food), source: "swiss", sourceReference: reference })
      .returning({ id: schema.food.id });
    await insertPortions(transaction, created.id, food);
    ids.set(reference, created.id);
  }
  return new Map(catalogFoods.map((food) => [food.slug, ids.get(uxSeedReferencePrefix + food.slug)!]));
}

async function createUser(transaction: Transaction, { email, name }: { email: string; name: string }) {
  const id = randomUUID();
  await transaction.insert(schema.user).values({ id, name, email, emailVerified: false });
  await transaction.insert(schema.account).values({
    id: randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: await hashPassword(password),
    updatedAt: new Date(),
  });
  return id;
}

async function writeProfile(
  transaction: Transaction,
  userId: string,
  values: ProfileSeed,
  weightKg: number,
  today: string,
) {
  const targets = computeDailyTargets({ ...values, weightKg, age: ageOn(values.birthDate, today) });
  await transaction.insert(schema.profile).values({
    userId,
    sex: values.sex,
    birthDate: values.birthDate,
    heightCm: values.heightCm,
    activityLevel: values.activityLevel,
    goal: values.goal,
    weeklyRateKg: values.weeklyRateKg,
    targetWeightKg: values.targetWeightKg,
    targetKcal: targets.kcal,
    targetProteinG: targets.proteinG,
    targetCarbsG: targets.carbsG,
    targetFatG: targets.fatG,
    lastCheckInWeek: weekStart(today),
  });
  return targets;
}

function snapshotValues(item: Parameters<typeof entrySnapshot>[0], foodIds: Map<string, string>, recipeIds: Map<string, string>) {
  const { food, recipe, ...values } = entrySnapshot(item);
  return { ...values, foodId: food ? foodIds.get(food)! : null, recipeId: recipe ? recipeIds.get(recipe)! : null };
}

async function seedFullUser(transaction: Transaction, catalogIds: Map<string, string>, today: string) {
  const userId = await createUser(transaction, uxUsers.full);
  const foodIds = new Map(catalogIds);
  for (const food of personalFoods) {
    const [created] = await transaction
      .insert(schema.food)
      .values({ ...foodValues(food), brand: food.brand, ownerId: userId, source: "user" })
      .returning({ id: schema.food.id });
    await insertPortions(transaction, created.id, food);
    foodIds.set(food.slug, created.id);
  }

  const recipeIds = new Map<string, string>();
  for (const recipe of recipes) {
    const [created] = await transaction
      .insert(schema.recipe)
      .values({ ownerId: userId, name: recipe.name, servings: recipe.servings, cookedWeightG: recipe.cookedWeightG })
      .returning({ id: schema.recipe.id });
    await transaction.insert(schema.recipeIngredient).values(
      recipe.ingredients.map(({ food, grams }, position) => ({
        recipeId: created.id,
        foodId: foodIds.get(food)!,
        grams,
        position,
      })),
    );
    recipeIds.set(recipe.slug, created.id);
  }

  await transaction
    .insert(schema.favoriteFood)
    .values(favoriteFoodSlugs.map((slug) => ({ userId, foodId: foodIds.get(slug)! })));

  await transaction.insert(schema.measurement).values(
    weighIns.map(({ offset, weightKg }) => ({ userId, measuredOn: addDays(today, offset), weightKg })),
  );
  const latestWeight = weighIns[weighIns.length - 1].weightKg;
  const targets = await writeProfile(transaction, userId, fullProfile, latestWeight, today);

  const plan = diaryPlan(today);
  let createdAt = new Date(`${addDays(today, -30)}T08:00:00Z`).getTime();
  for (const { day, meal, items } of plan) {
    await transaction.insert(schema.diaryEntry).values(
      items.map((item) => {
        createdAt += 60_000;
        return { ...snapshotValues(item, foodIds, recipeIds), userId, day, meal, createdAt: new Date(createdAt) };
      }),
    );
  }
  await transaction.insert(schema.incompleteDay).values({ userId, day: addDays(today, incompleteDayOffset) });

  for (const savedMeal of savedMeals) {
    const [created] = await transaction
      .insert(schema.savedMeal)
      .values({ userId, name: savedMeal.name, defaultMeal: savedMeal.defaultMeal })
      .returning({ id: schema.savedMeal.id });
    await transaction.insert(schema.savedMealItem).values(
      savedMeal.items.map((item, position) => {
        if (item.type === "food") return { savedMealId: created.id, foodId: foodIds.get(item.food)!, grams: item.grams, position };
        if (item.type === "recipe") return { savedMealId: created.id, recipeId: recipeIds.get(item.recipe)!, servings: item.servings, position };
        throw new Error("Saved meals cannot hold quick items");
      }),
    );
  }

  for (const storedMeal of storedMeals) {
    const [created] = await transaction
      .insert(schema.storedMeal)
      .values({
        userId,
        name: storedMeal.name,
        location: storedMeal.location,
        preparedOn: addDays(today, storedMeal.preparedOnOffset),
        portions: storedMeal.portions,
      })
      .returning({ id: schema.storedMeal.id });
    await transaction.insert(schema.storedMealItem).values(
      storedMeal.items.map((item, position) => ({
        ...snapshotValues(item, foodIds, recipeIds),
        storedMealId: created.id,
        position,
      })),
    );
  }

  await transaction.insert(schema.cookware).values(cookware.map((item) => ({ userId, ...item })));
  return { userId, entries: plan.reduce((count, meal) => count + meal.items.length, 0), targetKcal: targets.kcal };
}

async function seedEmptyUser(transaction: Transaction, today: string) {
  const userId = await createUser(transaction, uxUsers.empty);
  const { weightKg, ...values } = emptyProfile;
  await transaction.insert(schema.measurement).values({ userId, measuredOn: today, weightKg });
  await writeProfile(transaction, userId, values, weightKg, today);
  return userId;
}

async function main() {
  const today = todayIsoDate();
  const result = await database.transaction(async (transaction) => {
    await transaction
      .delete(schema.user)
      .where(inArray(schema.user.email, [uxUsers.full.email, uxUsers.empty.email]));
    const catalogIds = await ensureCatalog(transaction);
    const full = await seedFullUser(transaction, catalogIds, today);
    await seedEmptyUser(transaction, today);
    const [catalog] = await transaction
      .select({ total: count() })
      .from(schema.food)
      .where(like(schema.food.sourceReference, `${uxSeedReferencePrefix}%`));
    return { ...full, catalogFoods: catalog.total };
  });
  console.log(
    `UX seed ready on ${hostname} for ${today}: ${result.catalogFoods} catalog foods, ` +
      `${result.entries} diary entries for ${uxUsers.full.email} (target ${result.targetKcal} kcal), ` +
      `empty account ${uxUsers.empty.email}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

