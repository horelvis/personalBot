import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../src/db/index.ts";
import { createToolGateway } from "../../src/tool-gateway/gateway.ts";
import { createTestDatabase } from "../helpers/database.ts";
import { createUser } from "../helpers/users.ts";

let db: Database;
let ana: Awaited<ReturnType<typeof createUser>>;

beforeEach(async () => {
  db = await createTestDatabase();
  ana = await createUser(db, "ana@example.com");
});

describe("tool gateway store", () => {
  it("rejects a rule whose effect is neither allow nor deny, so a typo cannot silently allow", async () => {
    await expect(db.execute(sql`insert into tool_rules (tool, effect) values ('remember', 'Deny')`)).rejects.toThrow();
  });

  it("rejects an audit row whose decision is neither allow nor deny", async () => {
    await expect(
      db.execute(
        sql`insert into tool_audit (user_id, thread_id, run_id, tool, input, decision) values (${ana.id}, 't', 'r', 'x', '{}', 'maybe')`,
      ),
    ).rejects.toThrow();
  });

  it("audits a call that arrives without input instead of failing", async () => {
    const gateway = createToolGateway(db);
    await expect(gateway.authorize({ userId: ana.id, threadId: "t", runId: "r", tool: "probe", input: undefined })).resolves.toEqual({
      allowed: true,
    });
    expect(await gateway.audit(ana.id)).toEqual([expect.objectContaining({ tool: "probe", input: null, decision: "allow" })]);
  });
});
