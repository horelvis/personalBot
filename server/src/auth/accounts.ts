import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { users } from "../db/schema.ts";
import type { User } from "./identify.ts";
import type { OidcIdentity } from "./oidc.ts";

export interface AccessPolicy {
  /** Lower-case email of the one person this instance serves; any other identity is refused. */
  ownerEmail: string;
  /** Without it, only an email the provider marks email_verified: true can sign in. */
  trustUnverifiedEmail: boolean;
}

/** The account for someone the provider signed in, or null when they may not sign in. */
export async function signInAccount(db: Database, identity: OidcIdentity, access: AccessPolicy): Promise<User | null> {
  const email = identity.email?.trim().toLowerCase();
  if (!email || identity.emailVerified === false) return null;
  // An unverified email may be one the person merely typed in at the provider; it must not claim an account.
  if (identity.emailVerified !== true && !access.trustUnverifiedEmail) return null;
  if (email !== access.ownerEmail.toLowerCase()) return null;

  const profile = { email, name: identity.name ?? null };
  // Accounts created by hand may keep mixed case; sign-in always compares lower case.
  const [sameEmail] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email));
  const ownsEmail = sameEmail?.oidcIssuer === identity.issuer && sameEmail.oidcSubject === identity.subject;
  const sameIdentity = and(eq(users.oidcIssuer, identity.issuer), eq(users.oidcSubject, identity.subject));
  const [known] = await db.select({ id: users.id }).from(users).where(sameIdentity);
  if (known) {
    // Their email moved at the provider to one another account already has: refuse rather than merge.
    if (sameEmail && !ownsEmail) return null;
    const [updated] = await db.update(users).set(profile).where(eq(users.id, known.id)).returning();
    return updated ?? null;
  }

  if (sameEmail) {
    // An account created before sign-in existed is linked once; one owned by another identity is never taken over.
    if (sameEmail.oidcSubject !== null) return null;
    const [linked] = await db
      .update(users)
      .set({ ...profile, oidcIssuer: identity.issuer, oidcSubject: identity.subject })
      .where(eq(users.id, sameEmail.id))
      .returning();
    return linked ?? null;
  }

  const [created] = await db
    .insert(users)
    .values({ ...profile, oidcIssuer: identity.issuer, oidcSubject: identity.subject })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // A concurrent sign-in of the same person won the insert: use its account.
  const [winner] = await db.select().from(users).where(sameIdentity);
  return winner ?? null;
}
