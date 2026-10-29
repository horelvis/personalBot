import type { Database } from "../db/index.ts";
import type { Identify } from "./identify.ts";
import { type SessionStore, sessionIdentify } from "./sessions.ts";
import { singleUserIdentify } from "./single-user.ts";

/** How requests are signed in, from the config. With no sign-in configured, nobody is, whatever sessions are stored. */
export function chooseIdentify(
  config: { singleUser: boolean; oidc?: { ownerEmail: string } },
  { db, sessions }: { db: Database; sessions: SessionStore },
): Identify {
  if (config.singleUser) return singleUserIdentify(db);
  if (config.oidc) return sessionIdentify(sessions, { ownerEmail: config.oidc.ownerEmail });
  return async () => null;
}
