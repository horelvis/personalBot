import { eq } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { users } from "../db/schema.ts";
import type { Identify, User } from "./identify.ts";

const LOCAL_EMAIL = "local@localhost";

/** Development only: every request is the same local person, with no sign-in. loadConfig keeps it out of production. */
export function singleUserIdentify(db: Database): Identify {
  let local: Promise<User> | undefined;
  return () =>
    (local ??= ensureLocalUser(db).catch((error: unknown) => {
      // Not cached: the database may simply not be ready yet on the first request.
      local = undefined;
      throw error;
    }));
}

async function ensureLocalUser(db: Database): Promise<User> {
  await db.insert(users).values({ email: LOCAL_EMAIL, name: "Local" }).onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, LOCAL_EMAIL));
  if (!user) throw new Error("local user not created");
  return user;
}
