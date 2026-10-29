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

  it("enables single-user mode outside production only when SINGLE_USER=true", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x", SINGLE_USER: "true" }).singleUser).toBe(true);
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x" }).singleUser).toBe(false);
  });
});
