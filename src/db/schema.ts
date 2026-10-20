import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const mealTypeEnum = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const foodSourceEnum = pgEnum("food_source", ["swiss", "open_food_facts", "user"]);
export const foodUnitEnum = pgEnum("food_unit", ["g", "ml"]);
export const sexEnum = pgEnum("sex", ["male", "female"]);
export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);
export const goalTypeEnum = pgEnum("goal_type", ["lose", "maintain", "gain"]);
export const diaryEntryKindEnum = pgEnum("diary_entry_kind", ["food", "recipe", "quick"]);
export const diaryEntrySourceEnum = pgEnum("diary_entry_source", ["app", "connector", "shortcut"]);
export const aiRequestKindEnum = pgEnum("ai_request_kind", ["nutrition_label", "meal_description", "shortcut_meal"]);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const profile = pgTable("profile", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  sex: sexEnum(),
  birthDate: date({ mode: "string" }),
  heightCm: real(),
  activityLevel: activityLevelEnum().notNull().default("light"),
  goal: goalTypeEnum().notNull().default("maintain"),
  weeklyRateKg: real().notNull().default(0.5),
  targetKcal: integer(),
  targetProteinG: integer(),
  targetCarbsG: integer(),
  targetFatG: integer(),
  targetsCustomized: boolean().notNull().default(false),
  reminderEvening: boolean().notNull().default(false),
  reminderWeighInWeekday: integer(),
  ...timestamps,
});

export const food = pgTable(
  "food",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text().references(() => user.id, { onDelete: "cascade" }),
    replacesFoodId: uuid(),
    source: foodSourceEnum().notNull(),
    sourceReference: text(),
    barcode: text(),
    name: text().notNull(),
    brand: text(),
    category: text(),
    unit: foodUnitEnum().notNull().default("g"),
    kcal: real().notNull(),
    protein: real().notNull().default(0),
    carbs: real().notNull().default(0),
    sugars: real(),
    fat: real().notNull().default(0),
    saturatedFat: real(),
    fiber: real(),
    salt: real(),
    micronutrients: jsonb().$type<Record<string, number>>(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: "food_replaces_food_id_food_id_fk",
      columns: [table.replacesFoodId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    index("food_owner_index").on(table.ownerId),
    index("food_barcode_index").on(table.barcode),
    uniqueIndex("food_global_source_unique")
      .on(table.source, table.sourceReference)
      .where(sql`${table.ownerId} is null and ${table.sourceReference} is not null`),
    uniqueIndex("food_owner_replacement_unique")
      .on(table.ownerId, table.replacesFoodId)
      .where(sql`${table.replacesFoodId} is not null`),
  ],
);

export const foodPortion = pgTable(
  "food_portion",
  {
    id: uuid().primaryKey().defaultRandom(),
    foodId: uuid()
      .notNull()
      .references(() => food.id, { onDelete: "cascade" }),
    label: text().notNull(),
    grams: real().notNull(),
    position: integer().notNull().default(0),
  },
  (table) => [index("food_portion_food_index").on(table.foodId)],
);

export const recipe = pgTable(
  "recipe",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    servings: integer().notNull().default(1),
    cookedWeightG: real(),
    notes: text(),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("recipe_owner_index").on(table.ownerId)],
);

export const recipeIngredient = pgTable(
  "recipe_ingredient",
  {
    id: uuid().primaryKey().defaultRandom(),
    recipeId: uuid()
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    foodId: uuid()
      .notNull()
      .references(() => food.id, { onDelete: "no action" }),
    grams: real().notNull(),
    position: integer().notNull().default(0),
  },
  (table) => [index("recipe_ingredient_recipe_index").on(table.recipeId)],
);

export const favoriteFood = pgTable(
  "favorite_food",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    foodId: uuid()
      .notNull()
      .references(() => food.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.foodId] })],
);

export const favoriteRecipe = pgTable(
  "favorite_recipe",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeId: uuid()
      .notNull()
      .references(() => recipe.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.recipeId] })],
);

export const diaryEntry = pgTable(
  "diary_entry",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    meal: mealTypeEnum().notNull(),
    kind: diaryEntryKindEnum().notNull(),
    foodId: uuid().references(() => food.id, { onDelete: "set null" }),
    recipeId: uuid().references(() => recipe.id, { onDelete: "set null" }),
    label: text().notNull(),
    grams: real(),
    servings: real(),
    portionLabel: text(),
    kcal: real().notNull(),
    protein: real().notNull().default(0),
    carbs: real().notNull().default(0),
    fat: real().notNull().default(0),
    fiber: real(),
    sugars: real(),
    saturatedFat: real(),
    salt: real(),
    source: diaryEntrySourceEnum().notNull().default("app"),
    ...timestamps,
  },
  (table) => [
    index("diary_entry_user_day_index").on(table.userId, table.day),
    index("diary_entry_user_food_index").on(table.userId, table.foodId),
    check("diary_entry_kcal_non_negative", sql`${table.kcal} >= 0`),
  ],
);

export const savedMeal = pgTable(
  "saved_meal",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    defaultMeal: mealTypeEnum(),
    ...timestamps,
  },
  (table) => [index("saved_meal_user_index").on(table.userId)],
);

export const savedMealItem = pgTable(
  "saved_meal_item",
  {
    id: uuid().primaryKey().defaultRandom(),
    savedMealId: uuid()
      .notNull()
      .references(() => savedMeal.id, { onDelete: "cascade" }),
    foodId: uuid().references(() => food.id, { onDelete: "cascade" }),
    recipeId: uuid().references(() => recipe.id, { onDelete: "cascade" }),
    grams: real(),
    servings: real(),
    position: integer().notNull().default(0),
  },
  (table) => [
    index("saved_meal_item_saved_meal_index").on(table.savedMealId),
    check(
      "saved_meal_item_single_reference",
      sql`(${table.foodId} is null) <> (${table.recipeId} is null)`,
    ),
  ],
);

export const measurement = pgTable(
  "measurement",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    measuredOn: date({ mode: "string" }).notNull(),
    weightKg: real().notNull(),
    bodyFatPercent: real(),
    musclePercent: real(),
    visceralFat: real(),
    bodyWaterPercent: real(),
    boneMassKg: real(),
    waistCm: real(),
    hipCm: real(),
    note: text(),
    ...timestamps,
  },
  (table) => [index("measurement_user_day_index").on(table.userId, table.measuredOn)],
);

export const aiRequest = pgTable(
  "ai_request",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: aiRequestKindEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_request_user_created_index").on(table.userId, table.createdAt)],
);

export const apiToken = pgTable(
  "api_token",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    lastUsedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_token_hash_unique").on(table.tokenHash),
    uniqueIndex("api_token_user_unique").on(table.userId),
  ],
);

export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscription_endpoint_unique").on(table.endpoint),
    index("push_subscription_user_index").on(table.userId),
  ],
);
