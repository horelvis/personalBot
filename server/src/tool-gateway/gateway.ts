import { asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { toolAudit, toolRules } from "../db/schema.ts";

export type Effect = "allow" | "deny";

export interface ToolCall {
  userId: string;
  threadId: string;
  runId: string;
  tool: string;
  input: unknown;
}

export interface AuditEntry {
  userId: string;
  threadId: string;
  runId: string;
  tool: string;
  input: unknown;
  decision: Effect;
  createdAt: Date;
}

/** Decides every tool call by rule and records it before the tool is allowed to act. */
export function createToolGateway(db: Database) {
  return {
    async addRule(rule: { tool: string; effect: Effect }): Promise<void> {
      await db.insert(toolRules).values(rule);
    },

    /** A call is allowed unless a rule for its tool or for `*` denies it; deny wins over allow. */
    async authorize(call: ToolCall): Promise<{ allowed: boolean }> {
      const matching = await db
        .select({ effect: toolRules.effect })
        .from(toolRules)
        .where(inArray(toolRules.tool, [call.tool, "*"]));
      const decision: Effect = matching.some((rule) => rule.effect === "deny") ? "deny" : "allow";
      // Written before answering, so a call that is never recorded never runs.
      await db.insert(toolAudit).values({ ...call, input: call.input ?? null, decision });
      return { allowed: decision === "allow" };
    },

    audit(userId: string): Promise<AuditEntry[]> {
      return db
        .select({
          userId: toolAudit.userId,
          threadId: toolAudit.threadId,
          runId: toolAudit.runId,
          tool: toolAudit.tool,
          input: toolAudit.input,
          decision: toolAudit.decision,
          createdAt: toolAudit.createdAt,
        })
        .from(toolAudit)
        .where(eq(toolAudit.userId, userId))
        .orderBy(asc(toolAudit.createdAt));
    },
  };
}

export type ToolGateway = ReturnType<typeof createToolGateway>;
