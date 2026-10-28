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
});
