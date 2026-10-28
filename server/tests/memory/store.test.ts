import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/db/index.ts";
import { createMemoryStore } from "../../src/memory/store.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
beforeEach(async () => {
  db = await createTestDatabase();
});

describe("memory store", () => {
  it("keeps facts per person, newest first, and deletes only the owner's", async () => {
    const ana = await createUser(db, "ana@example.com");
    const luis = await createUser(db, "luis@example.com");
    let tick = 0;
    const memories = createMemoryStore(db, { now: () => new Date(Date.UTC(2026, 9, 28, 10, 0, tick++)) });
    const first = await memories.add(ana.id, "Trabaja en el equipo de pagos");
    await memories.add(ana.id, "Prefiere respuestas cortas");

    expect((await memories.list(ana.id)).map((memory) => memory.content)).toEqual([
      "Prefiere respuestas cortas",
      "Trabaja en el equipo de pagos",
    ]);
    expect(await memories.list(luis.id)).toEqual([]);
    expect(await memories.remove(luis.id, first.id)).toBe(false);
    expect(await memories.remove(ana.id, first.id)).toBe(true);
    expect(await memories.list(ana.id)).toHaveLength(1);
  });

  it("finds facts by words, only among the person's own", async () => {
    const ana = await createUser(db, "ana@example.com");
    const luis = await createUser(db, "luis@example.com");
    const memories = createMemoryStore(db);
    await memories.add(ana.id, "Su gata se llama Mora");
    await memories.add(ana.id, "Trabaja en el equipo de pagos");
    await memories.add(luis.id, "Su gata se llama Nube");

    const found = await memories.search(ana.id, "gata");
    expect(found.map((memory) => memory.content)).toEqual(["Su gata se llama Mora"]);
    expect(await memories.search(ana.id, "inexistente")).toEqual([]);
  });
});
