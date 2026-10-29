import { loadConfig } from "../config.ts";
import { connectDatabase } from "./index.ts";

// connectDatabase applies pending migrations before returning.
const { close } = await connectDatabase(loadConfig(process.env).databaseUrl);
await close();
console.log("Migrations applied.");
