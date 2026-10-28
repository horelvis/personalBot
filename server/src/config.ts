export interface Config {
  databaseUrl: string;
  port: number;
}

type Environment = Record<string, string | undefined>;

/** Everything the server needs to start. Only DATABASE_URL is required: no hosted service owns our state. */
export function loadConfig(environment: Environment): Config {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required, e.g. postgres://personalbot:personalbot@localhost:5432/personalbot");
  }
  return {
    databaseUrl,
    port: environment.PORT ? Number(environment.PORT) : 3001,
  };
}
