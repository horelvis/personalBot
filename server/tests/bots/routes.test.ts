import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let asAdmin: ReturnType<typeof createApp>;
let asMember: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await createTestDatabase();
  const admin = await createUser(db, "boss@example.com", "admin");
  const member = await createUser(db, "ana@example.com");
  asAdmin = createApp({ db, identify: async () => admin });
  asMember = createApp({ db, identify: async () => member });
});

const register = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request("/api/bots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("/api/bots", () => {
  it("lets an admin register an AG-UI bot by URL, and everyone list it", async () => {
    const created = await register(asAdmin, { id: "research", name: "Research", url: "https://agents.example.com/research" });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ id: "research", name: "Research", url: "https://agents.example.com/research" });

    const listed = await asMember.request("/api/bots");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([{ id: "research", name: "Research", description: null }]);
  });

  it("forbids members from registering bots", async () => {
    const response = await register(asMember, { id: "x", name: "X", url: "https://agents.example.com/x" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Only admins can do this." });
    expect(await (await asMember.request("/api/bots")).json()).toEqual([]);
  });

  it("accepts only http(s) URLs, so nobody can point a bot at a built-in agent", async () => {
    expect((await register(asAdmin, { id: "x", name: "X", url: "builtin:assistant" })).status).toBe(400);
    expect((await register(asAdmin, { id: "x", name: "X", url: "not a url" })).status).toBe(400);
  });

  it("answers 409 for an id that is already taken", async () => {
    await register(asAdmin, { id: "research", name: "Research", url: "https://agents.example.com/research" });
    expect((await register(asAdmin, { id: "research", name: "Other", url: "https://agents.example.com/other" })).status).toBe(409);
  });
});
