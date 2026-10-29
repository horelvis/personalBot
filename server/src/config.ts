export interface Config {
  databaseUrl: string;
  port: number;
  /** The Claude model behind the built-in assistant. */
  assistantModel: string;
  /** False when ANTHROPIC_BASE_URL points the SDK at a gateway, which does not know Anthropic-only betas. */
  serverSideFallbacks: boolean;
  /** Development only: every request is one local person, with no sign-in. */
  singleUser: boolean;
  production: boolean;
  /** Directory of the built web app to serve, such as web/dist. */
  staticDir?: string;
  /** Sign-in through any OpenID Connect provider; without it, only SINGLE_USER mode can sign anyone in. */
  oidc?: OidcConfig;
  /** Settings that are set but have no effect, for the server to report at startup. */
  warnings: string[];
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** Lower-case email of the one person this instance serves; nobody else signs in. */
  ownerEmail: string;
  /** Accept an email the provider does not mark as verified, for providers such as Entra that never send email_verified. */
  trustUnverifiedEmail: boolean;
}

type Environment = Record<string, string | undefined>;

/** Everything the server needs to start. Only DATABASE_URL is required: no hosted service owns our state. */
export function loadConfig(environment: Environment): Config {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required, e.g. postgres://personalbot:personalbot@localhost:5432/personalbot");
  }
  const production = environment.NODE_ENV === "production";
  const singleUser = environment.SINGLE_USER === "true";
  // Opt-in, not opt-out: a forgotten or misspelled NODE_ENV must not leave the API open.
  if (singleUser && environment.NODE_ENV !== "development") {
    throw new Error("SINGLE_USER=true is for development only and needs NODE_ENV=development.");
  }
  return {
    databaseUrl,
    port: environment.PORT ? Number(environment.PORT) : 3001,
    assistantModel: environment.ASSISTANT_MODEL?.trim() || "claude-opus-5-5",
    serverSideFallbacks: !environment.ANTHROPIC_BASE_URL?.trim(),
    singleUser,
    production,
    oidc: loadOidcConfig(environment),
    warnings: retiredSettings(environment),
    ...(environment.STATIC_DIR?.trim() ? { staticDir: environment.STATIC_DIR.trim() } : {}),
  };
}

// Left over from the team version: one person per instance has no admins and no domain allow-list.
const retired: Record<string, string> = {
  ADMIN_EMAILS: "this instance serves one person, the one in OWNER_EMAIL.",
  OIDC_ALLOWED_DOMAINS: "only the email in OWNER_EMAIL can sign in.",
};

function retiredSettings(environment: Environment): string[] {
  return Object.entries(retired)
    .filter(([name]) => environment[name]?.trim())
    .map(([name, reason]) => `${name} is ignored: ${reason}`);
}

function loadOidcConfig(environment: Environment): OidcConfig | undefined {
  const issuer = environment.OIDC_ISSUER?.trim();
  if (!issuer) return undefined;
  const required = (name: string, hint: string) => {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`${name} is required when OIDC_ISSUER is set: ${hint}`);
    return value;
  };
  const clientId = required("OIDC_CLIENT_ID", "the client id registered at the provider.");
  const publicUrl = required("PUBLIC_URL", "the address people open, e.g. https://bot.example.com.");
  // One person per instance: with a public issuer such as Google, nobody but this email may get in.
  const ownerEmail = email("OWNER_EMAIL", required("OWNER_EMAIL", "the email of the one person this instance serves, e.g. ana@example.com."));
  const clientSecret = environment.OIDC_CLIENT_SECRET?.trim();
  return {
    issuer,
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    redirectUri: callbackUrl(publicUrl),
    ownerEmail,
    trustUnverifiedEmail: environment.OIDC_TRUST_UNVERIFIED_EMAIL === "true",
  };
}

function callbackUrl(publicUrl: string): string {
  if (!URL.canParse(publicUrl)) throw new Error(`PUBLIC_URL is not a valid URL: ${publicUrl}. Use e.g. https://bot.example.com.`);
  // Relative to a trailing slash, so an app served under a path prefix keeps it.
  const base = new URL(publicUrl);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL("auth/callback", base).href;
}

function email(name: string, value: string): string {
  if (!/^[^\s@,]+@[^\s@,]+$/.test(value)) throw new Error(`${name} is not an email address: ${value}. Use one email, e.g. ana@example.com.`);
  return value.toLowerCase();
}
