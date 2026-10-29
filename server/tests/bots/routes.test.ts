import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let asOwner: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await createTestDatabase();
  const owner = await createUser(db, "ana@example.com");
  asOwner = createApp({ db, identify: async () => owner });
});

const register = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request("/api/bots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("/api/bots", () => {
  it("lets the signed-in person register an AG-UI bot by URL and list it", async () => {
    const created = await register(asOwner, { id: "research", name: "Research", url: "https://agents.example.com/research" });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "research", name: "Research", url: "https://agents.example.com/research" });

    const listed = await asOwner.request("/api/bots");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([{ id: "research", name: "Research", description: null }]);
  });

  it("accepts only http(s) URLs, so nobody can point a bot at a built-in agent", async () => {
    expect((await register(asOwner, { id: "x", name: "X", url: "builtin:assistant" })).status).toBe(400);
    expect((await register(asOwner, { id: "x", name: "X", url: "not a url" })).status).toBe(400);
  });

  it("answers 409 for an id that is already taken", async () => {
    await register(asOwner, { id: "research", name: "Research", url: "https://agents.example.com/research" });
    expect((await register(asOwner, { id: "research", name: "Other", url: "https://agents.example.com/other" })).status).toBe(409);
  });
});
