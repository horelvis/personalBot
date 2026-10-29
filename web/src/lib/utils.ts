// Adapted from CopilotKit/openbot (app/src/lib/utils.ts, commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
