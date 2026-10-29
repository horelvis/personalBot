import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";
import { createTestDatabase } from "./helpers/database.ts";
import { createUser } from "./helpers/users.ts";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "personalbot-static-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>personalBot</title>");
  writeFileSync(join(dir, "assets", "app.js"), "console.log('app')");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("serving the web app", () => {
  it("serves the built web app and falls back to index.html for client routes, leaving the API alone", async () => {
    const app = createApp({ db: await createTestDatabase(), identify: async () => null, staticDir: dir });

    expect(await (await app.request("/")).text()).toContain("<title>personalBot</title>");
    const asset = await app.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(await asset.text()).toContain("console.log");
    expect(await (await app.request("/threads/123")).text()).toContain("<title>personalBot</title>");
    expect((await app.request("/api/me")).status).toBe(401);
    expect((await app.request("/api/unknown")).status).toBe(401);
  });

  it("answers a signed-in request to an unknown API path exactly as it does without STATIC_DIR", async () => {
    const db = await createTestDatabase();
    const ana = await createUser(db, "ana@example.com");
    const withWeb = createApp({ db, identify: async () => ana, staticDir: dir });
    const apiOnly = createApp({ db, identify: async () => ana });
    for (const path of ["/api/unknown", "/api"]) {
      const [served, plain] = [await withWeb.request(path), await apiOnly.request(path)];
      expect(served.status).toBe(404);
      expect(await served.text()).toBe(await plain.text());
    }
  });

  it("does not serve anything outside the API when STATIC_DIR is not set", async () => {
    const app = createApp({ db: await createTestDatabase(), identify: async () => null });
    expect((await app.request("/")).status).toBe(404);
  });

  it("reads STATIC_DIR", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x", STATIC_DIR: "/app/web/dist" }).staticDir).toBe("/app/web/dist");
    expect(loadConfig({ DATABASE_URL: "postgres://x@localhost/x" }).staticDir).toBeUndefined();
  });
});
