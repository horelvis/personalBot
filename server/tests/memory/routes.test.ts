import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
beforeEach(async () => {
  db = await createTestDatabase();
});

describe("/api/memories", () => {
  it("lets each person add, list and delete their own facts", async () => {
    const ana = await createUser(db, "ana@example.com");
    const luis = await createUser(db, "luis@example.com");
    const asAna = createApp({ db, identify: async () => ana });
    const asLuis = createApp({ db, identify: async () => luis });

    const created = await asAna.request("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Prefiere respuestas cortas" }),
    });
    expect(created.status).toBe(201);
    const memory = (await created.json()) as { id: string };

    expect(await (await asLuis.request("/api/memories")).json()).toEqual([]);
    expect((await asLuis.request(`/api/memories/${memory.id}`, { method: "DELETE" })).status).toBe(404);
    expect((await asAna.request(`/api/memories/${memory.id}`, { method: "DELETE" })).status).toBe(204);
    expect(await (await asAna.request("/api/memories")).json()).toEqual([]);
  });

  it("rejects an empty fact", async () => {
    const ana = await createUser(db, "ana@example.com");
    const response = await createApp({ db, identify: async () => ana }).request("/api/memories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "  " }),
    });
    expect(response.status).toBe(400);
  });
});
