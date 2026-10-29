// Adapted from CopilotKit/openbot (app/src/components/ui/label.tsx, commit 4766e42). Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import type * as React from "react";

import { cn } from "../../lib/utils.ts";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
