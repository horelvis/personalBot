import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** A function the built-in assistant may call. Inputs are validated before run is reached. */
export interface AssistantTool<Input = unknown> {
  name: string;
  description: string;
  input: z.ZodType<Input>;
  run(input: Input): Promise<string>;
}

export function defineTool<Input>(tool: AssistantTool<Input>): AssistantTool {
  return tool as AssistantTool;
}

export function toolDefinition(tool: AssistantTool): Anthropic.Beta.BetaTool {
  const { $schema: _, ...schema } = z.toJSONSchema(tool.input) as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description,
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
    // Streamed tool input is not validated by the API; AssistantTool.input does that.
    eager_input_streaming: true,
  };
}
