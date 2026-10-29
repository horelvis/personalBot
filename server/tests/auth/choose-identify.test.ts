import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.ts";
import { chooseIdentify } from "../../src/auth/choose-identify.ts";
import { SESSION_COOKIE, createSessionStore } from "../../src/auth/sessions.ts";
import type { Database } from "../../src/db/index.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let token: string;

beforeEach(async () => {
  db = await createTestDatabase();
  const ana = await createUser(db, "ana@example.com");
  token = await createSessionStore(db).create(ana.id);
});

const me = (config: Parameters<typeof chooseIdentify>[0]) =>
  createApp({ db, identify: chooseIdentify(config, { db, sessions: createSessionStore(db) }) }).request("/api/me", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });

describe("chooseIdentify", () => {
  it("admits nobody when neither OIDC nor SINGLE_USER is configured, even with a session left from before", async () => {
    expect((await me({ singleUser: false })).status).toBe(401);
  });

  it("admits the owner's session when OIDC is configured", async () => {
    expect((await me({ singleUser: false, oidc: { ownerEmail: "ana@example.com" } })).status).toBe(200);
    expect((await me({ singleUser: false, oidc: { ownerEmail: "luis@example.com" } })).status).toBe(401);
  });

  it("uses the local person in SINGLE_USER mode", async () => {
    expect(await (await me({ singleUser: true })).json()).toMatchObject({ email: "local@localhost" });
  });
});
