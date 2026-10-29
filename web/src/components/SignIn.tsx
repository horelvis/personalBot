export function SignIn() {
  return (
    <main className="sign-in">
      <h1>personalBot</h1>
      <p>Sign in to talk to your bots.</p>
      {/* A full-page navigation: the server redirects to the identity provider. */}
      <a className="button" href="/auth/login">
        Sign in
      </a>
    </main>
  );
}
