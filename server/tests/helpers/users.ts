import type { Database } from "../../src/db/index.ts";
import { users } from "../../src/db/schema.ts";

export async function createUser(db: Database, email: string) {
  const [user] = await db.insert(users).values({ email }).returning();
  if (!user) throw new Error("user not created");
  return user;
}
