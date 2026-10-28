export interface Config {
  databaseUrl: string;
  port: number;
  /** The Claude model behind the built-in assistant. */
  assistantModel: string;
  /** Development only: everyone is one local admin, with no sign-in. */
  singleUser: boolean;
  production: boolean;
}

type Environment = Record<string, string | undefined>;

/** Everything the server needs to start. Only DATABASE_URL is required: no hosted service owns our state. */
export function loadConfig(environment: Environment): Config {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required, e.g. postgres://personalbot:personalbot@localhost:5432/personalbot");
  }
  const production = environment.NODE_ENV === "production";
  const singleUser = environment.SINGLE_USER === "true";
  if (singleUser && production) {
    throw new Error("SINGLE_USER=true is for development only and cannot run with NODE_ENV=production.");
  }
  return {
    databaseUrl,
    port: environment.PORT ? Number(environment.PORT) : 3001,
    assistantModel: environment.ASSISTANT_MODEL?.trim() || "claude-opus-5-5",
    singleUser,
    production,
  };
}
