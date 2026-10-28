import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.ts";

/** Either driver: node-postgres in production, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;

export async function connectDatabase(databaseUrl: string): Promise<{ db: Database; close: () => Promise<void> }> {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => pool.end() };
}

export async function ping(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
