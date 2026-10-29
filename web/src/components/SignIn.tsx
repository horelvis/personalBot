// Sign-in layout adapted from CopilotKit/openbot (app/src/routes/sign.tsx, commit 4766e42).
// Copyright (c) 2026 CopilotKit. MIT License; see web/NOTICE.
import { buttonVariants } from "./ui/button.tsx";

export function SignIn() {
  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center">
      <div className="flex w-full max-w-82 flex-col items-center p-4">
        <h1 className="text-center text-2xl font-medium tracking-tight">personalBot</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">Sign in to talk to your bots.</p>
        {/* A full-page navigation: the server redirects to the identity provider. */}
        <a className={buttonVariants({ variant: "outline", className: "mt-8 h-10 w-full tracking-tight" })} href="/auth/login">
          Sign in
        </a>
      </div>
    </main>
  );
}
