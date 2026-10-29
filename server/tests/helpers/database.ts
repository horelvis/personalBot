import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { type Database, migrationsFolder } from "../../src/db/index.ts";
import * as schema from "../../src/db/schema.ts";

/** A fresh in-process Postgres with the real migrations applied. */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
