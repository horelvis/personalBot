import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { users } from "../db/schema.ts";
import type { User } from "./identify.ts";
import type { OidcIdentity } from "./oidc.ts";

export interface AccessPolicy {
  /** Email domains allowed to sign in, or "*" for anyone the issuer authenticates. */
  allowedDomains: string[] | "*";
  /** Lower-case emails that sign in as admin; everyone else is a member. */
  adminEmails: string[];
}

/** The account for someone the provider signed in, or null when they may not sign in. */
export async function signInAccount(db: Database, identity: OidcIdentity, access: AccessPolicy): Promise<User | null> {
  const email = identity.email?.trim().toLowerCase();
  if (!email || identity.emailVerified === false) return null;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (access.allowedDomains !== "*" && !access.allowedDomains.includes(domain) && !access.adminEmails.includes(email)) return null;

  // ADMIN_EMAILS is the source of truth for the role, so removing someone from it demotes them on their next sign-in.
  const profile = { email, name: identity.name ?? null, role: access.adminEmails.includes(email) ? ("admin" as const) : ("member" as const) };
  const sameIdentity = and(eq(users.oidcIssuer, identity.issuer), eq(users.oidcSubject, identity.subject));
  const [known] = await db.update(users).set(profile).where(sameIdentity).returning();
  if (known) return known;

  const [sameEmail] = await db.select().from(users).where(eq(users.email, email));
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

  const [created] = await db.insert(users).values({ ...profile, oidcIssuer: identity.issuer, oidcSubject: identity.subject }).returning();
  return created ?? null;
}
