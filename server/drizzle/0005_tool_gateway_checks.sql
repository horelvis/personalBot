ALTER TABLE "tool_audit" ALTER COLUMN "input" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tool_audit" ADD CONSTRAINT "tool_audit_decision_check" CHECK ("tool_audit"."decision" in ('allow', 'deny'));--> statement-breakpoint
ALTER TABLE "tool_rules" ADD CONSTRAINT "tool_rules_effect_check" CHECK ("tool_rules"."effect" in ('allow', 'deny'));