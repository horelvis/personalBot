import type { Message } from "@ag-ui/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/db/index.ts";
import { ThreadBusyError, createThreadStore } from "../../src/threads/store.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
beforeEach(async () => {
  db = await createTestDatabase();
});

describe("thread store", () => {
  it("creates a thread and lists it for its owner, newest first", async () => {
    const ana = await createUser(db, "ana@example.com");
    let tick = 0;
    const store = createThreadStore(db, { now: () => new Date(Date.UTC(2026, 9, 28, 10, 0, tick++)) });
    const first = await store.create({ ownerId: ana.id, botId: "assistant", title: "Primero" });
    const second = await store.create({ ownerId: ana.id, botId: "assistant", title: "Segundo" });
    await store.touch(first.id);

    const listed = await store.list(ana.id);
    expect(listed.map((thread) => thread.title)).toEqual(["Primero", "Segundo"]);
    expect(listed.map((thread) => thread.id)).toContain(second.id);
  });

  it("keeps the history in order and survives a new store instance (restart)", async () => {
    const ana = await createUser(db, "ana@example.com");
    const thread = await createThreadStore(db).create({ ownerId: ana.id, botId: "assistant" });
    const messages: Message[] = [
      { id: "m1", role: "user", content: "Hola" },
      { id: "m2", role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
    ];
    await createThreadStore(db).append(thread.id, messages);
    await createThreadStore(db).append(thread.id, [{ id: "m3", role: "user", content: "Gracias" }]);

    const history = await createThreadStore(db).history(thread.id);
    expect(history).toEqual([...messages, { id: "m3", role: "user", content: "Gracias" }]);
  });

  it("replaces a message re-sent with the same id instead of duplicating it", async () => {
    const ana = await createUser(db, "ana@example.com");
    const store = createThreadStore(db);
    const thread = await store.create({ ownerId: ana.id, botId: "assistant" });
    await store.append(thread.id, [{ id: "m1", role: "assistant", content: "borrador" }]);
    await store.append(thread.id, [{ id: "m1", role: "assistant", content: "final" }]);
    expect(await store.history(thread.id)).toEqual([{ id: "m1", role: "assistant", content: "final" }]);
  });

  it("never returns another person's thread", async () => {
    const ana = await createUser(db, "ana@example.com");
    const luis = await createUser(db, "luis@example.com");
    const store = createThreadStore(db);
    const thread = await store.create({ ownerId: ana.id, botId: "assistant" });

    expect(await store.get(luis.id, thread.id)).toBeNull();
    expect(await store.list(luis.id)).toEqual([]);
    expect((await store.get(ana.id, thread.id))?.id).toBe(thread.id);
  });

  it("allows only one active run per thread", async () => {
    const ana = await createUser(db, "ana@example.com");
    const store = createThreadStore(db);
    const thread = await store.create({ ownerId: ana.id, botId: "assistant" });

    const release = await store.lock(thread.id, "run-1");
    await expect(store.lock(thread.id, "run-2")).rejects.toBeInstanceOf(ThreadBusyError);
    await release();
    const releaseAgain = await store.lock(thread.id, "run-2");
    await releaseAgain();
  });

  it("takes over a lock left behind by a crashed run once it is stale", async () => {
    const ana = await createUser(db, "ana@example.com");
    let now = new Date("2026-10-28T10:00:00Z");
    const store = createThreadStore(db, { lockTimeoutMs: 60_000, now: () => now });
    const thread = await store.create({ ownerId: ana.id, botId: "assistant" });

    await store.lock(thread.id, "crashed-run");
    now = new Date("2026-10-28T10:02:00Z");
    const release = await store.lock(thread.id, "next-run");
    await release();
  });
});
