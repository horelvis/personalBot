import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.ts";
import { singleUserIdentify } from "../../src/auth/single-user.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";

let db: Database;
beforeEach(async () => {
  db = await createTestDatabase();
});

describe("single-user development mode", () => {
  it("signs every request in as the same local admin without any login", async () => {
    const app = createApp({ db, identify: singleUserIdentify(db) });
    const first = await (await app.request("/api/me")).json();
    const second = await (await app.request("/api/me")).json();
    expect(first).toMatchObject({ email: "local@localhost", role: "admin" });
    expect(second).toEqual(first);
  });

  it("recovers when the database was not ready on the first request", async () => {
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("connection refused");
    });
    const app = createApp({ db, identify: singleUserIdentify(db) });
    expect((await app.request("/api/me")).status).toBe(500);
    expect(await (await app.request("/api/me")).json()).toMatchObject({ email: "local@localhost" });
  });
});

