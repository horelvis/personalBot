import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.ts";

describe("loadConfig", () => {
  it("starts with only DATABASE_URL: no Intelligence or other hosted service is required", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://bot:bot@localhost:5432/bot" });
    expect(config.databaseUrl).toBe("postgres://bot:bot@localhost:5432/bot");
    expect(config.port).toBe(3001);
  });

  it("refuses to start without DATABASE_URL and names the variable", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("reads PORT when set", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://x@localhost/x", PORT: "8080" });
    expect(config.port).toBe(8080);
  });

  it("uses Claude Opus 5.5 for the built-in assistant unless ASSISTANT_MODEL says otherwise", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x" }).assistantModel).toBe("claude-opus-5-5");
    const config = loadConfig({ DATABASE_URL: "postgres://x@localhost/x", ASSISTANT_MODEL: "claude-sonnet-5-5" });
    expect(config.assistantModel).toBe("claude-sonnet-5-5");
  });

  it("refuses SINGLE_USER=true when NODE_ENV=production", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://x@localhost/x", SINGLE_USER: "true", NODE_ENV: "production" })).toThrow(
      /SINGLE_USER=true is for development only/,
    );
  });

  it("enables single-user mode only with SINGLE_USER=true and an explicit NODE_ENV=development", () => {
    const base = { DATABASE_URL: "postgres://x@localhost/x" };
    expect(loadConfig({ ...base, SINGLE_USER: "true", NODE_ENV: "development" }).singleUser).toBe(true);
    expect(loadConfig(base).singleUser).toBe(false);
    expect(() => loadConfig({ ...base, SINGLE_USER: "true" })).toThrow(/NODE_ENV=development/);
    expect(() => loadConfig({ ...base, SINGLE_USER: "true", NODE_ENV: "prod" })).toThrow(/NODE_ENV=development/);
  });

  it("trusts unverified emails only when OIDC_TRUST_UNVERIFIED_EMAIL=true", () => {
    const oidc = { DATABASE_URL: "postgres://x@localhost/x", OIDC_ISSUER: "https://i", OIDC_CLIENT_ID: "c", PUBLIC_URL: "http://l", OWNER_EMAIL: "ana@example.com" };
    expect(loadConfig(oidc).oidc?.trustUnverifiedEmail).toBe(false);
    expect(loadConfig({ ...oidc, OIDC_TRUST_UNVERIFIED_EMAIL: "true" }).oidc?.trustUnverifiedEmail).toBe(true);
  });

  it("reads OIDC settings and refuses an issuer without the variables it needs", () => {
    const base = { DATABASE_URL: "postgres://x@localhost/x" };
    expect(loadConfig(base).oidc).toBeUndefined();
    expect(() => loadConfig({ ...base, OIDC_ISSUER: "https://idp.test" })).toThrow(/OIDC_CLIENT_ID/);
    expect(() => loadConfig({ ...base, OIDC_ISSUER: "https://idp.test", OIDC_CLIENT_ID: "c" })).toThrow(/PUBLIC_URL/);
    expect(() =>
      loadConfig({ ...base, OIDC_ISSUER: "https://idp.test", OIDC_CLIENT_ID: "c", PUBLIC_URL: "https://bot.example.com" }),
    ).toThrow(/OWNER_EMAIL is required when OIDC_ISSUER is set/);

    const config = loadConfig({
      ...base,
      OIDC_ISSUER: "https://idp.test",
      OIDC_CLIENT_ID: "c",
      OIDC_CLIENT_SECRET: "s",
      PUBLIC_URL: "https://bot.example.com/",
      OWNER_EMAIL: " Ana@Example.com ",
    });
    expect(config.oidc).toEqual({
      issuer: "https://idp.test",
      clientId: "c",
      clientSecret: "s",
      redirectUri: "https://bot.example.com/auth/callback",
      ownerEmail: "ana@example.com",
      trustUnverifiedEmail: false,
    });
  });

  it("keeps a path prefix of PUBLIC_URL and rejects malformed sign-in settings with a hint", () => {
    const oidc = { DATABASE_URL: "postgres://x@localhost/x", OIDC_ISSUER: "https://i", OIDC_CLIENT_ID: "c", OWNER_EMAIL: "ana@example.com" };
    expect(loadConfig({ ...oidc, PUBLIC_URL: "https://example.com/bot" }).oidc?.redirectUri).toBe("https://example.com/bot/auth/callback");
    expect(() => loadConfig({ ...oidc, PUBLIC_URL: "not a url" })).toThrow(/PUBLIC_URL/);
    expect(() => loadConfig({ ...oidc, PUBLIC_URL: "https://example.com", OWNER_EMAIL: "ana.example.com" })).toThrow(/OWNER_EMAIL is not an email address/);
    expect(() => loadConfig({ ...oidc, PUBLIC_URL: "https://example.com", OWNER_EMAIL: "ana@example.com, luis@example.com" })).toThrow(/OWNER_EMAIL/);
  });

  it("warns about each retired team setting that is set, since one person per instance ignores it", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://x@localhost/x",
      ADMIN_EMAILS: "ana@example.com",
      OIDC_ALLOWED_DOMAINS: "example.com",
    });
    expect(config.warnings).toEqual([
      "ADMIN_EMAILS is ignored: this instance serves one person, the one in OWNER_EMAIL.",
      "OIDC_ALLOWED_DOMAINS is ignored: only the email in OWNER_EMAIL can sign in.",
    ]);
  });

  it("has no warnings when no retired setting is set, or it is blank", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x" }).warnings).toEqual([]);
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x", ADMIN_EMAILS: " ", OIDC_ALLOWED_DOMAINS: "" }).warnings).toEqual([]);
  });
});

