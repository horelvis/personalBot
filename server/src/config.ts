export interface Config {
  databaseUrl: string;
  port: number;
  /** The Claude model behind the built-in assistant. */
  assistantModel: string;
  /** Development only: everyone is one local admin, with no sign-in. */
  singleUser: boolean;
  production: boolean;
  /** Sign-in through any OpenID Connect provider; without it, only SINGLE_USER mode can sign anyone in. */
  oidc?: OidcConfig;
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  /** Email domains allowed to sign in, or "*" for anyone the issuer authenticates. */
  allowedDomains: string[] | "*";
  adminEmails: string[];
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
  if (singleUser && production) {
    throw new Error("SINGLE_USER=true is for development only and cannot run with NODE_ENV=production.");
  }
  return {
    databaseUrl,
    port: environment.PORT ? Number(environment.PORT) : 3001,
    assistantModel: environment.ASSISTANT_MODEL?.trim() || "claude-opus-5-5",
    singleUser,
    production,
    oidc: loadOidcConfig(environment),
  };
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
  // Required on purpose: with a public issuer such as Google, admitting everyone must be a choice.
  const domains = required("OIDC_ALLOWED_DOMAINS", 'comma-separated email domains allowed to sign in, or "*" for anyone.');
  const clientSecret = environment.OIDC_CLIENT_SECRET?.trim();
  return {
    issuer,
    clientId,
    ...(clientSecret ? { clientSecret } : {}),
    redirectUri: callbackUrl(publicUrl),
    allowedDomains: domains === "*" ? "*" : nonEmpty("OIDC_ALLOWED_DOMAINS", list(domains)),
    adminEmails: list(environment.ADMIN_EMAILS ?? ""),
  };
}

function callbackUrl(publicUrl: string): string {
  if (!URL.canParse(publicUrl)) throw new Error(`PUBLIC_URL is not a valid URL: ${publicUrl}. Use e.g. https://bot.example.com.`);
  // Relative to a trailing slash, so an app served under a path prefix keeps it.
  const base = new URL(publicUrl);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL("auth/callback", base).href;
}

function nonEmpty(name: string, values: string[]): string[] {
  if (!values.length) throw new Error(`${name} lists no domains. Use comma-separated domains, or "*" for anyone.`);
  return values;
}

const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
