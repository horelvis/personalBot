import type { Database } from "../../src/db/index.ts";
import { users } from "../../src/db/schema.ts";

export async function createUser(db: Database, email: string, role: "admin" | "member" = "member") {
  const [user] = await db.insert(users).values({ email, role }).returning();
  if (!user) throw new Error("user not created");
  return user;
}
