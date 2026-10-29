import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { createTestDatabase } from "./helpers/database.ts";

describe("GET /health", () => {
  it("answers ok when the database is reachable", async () => {
    const db = await createTestDatabase();
    const app = createApp({ db });
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
