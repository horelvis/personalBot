/** Port to an OpenID Connect provider, so sign-in works with Google, Entra, Keycloak or any other. */
export interface OidcProvider {
  redirectUri: string;
  /** Where to send the browser, and the values the callback must be checked against. */
  start(): Promise<{ url: URL; pending: PendingLogin }>;
  /** Checks the callback against pending and returns who signed in; throws when anything does not match. */
  finish(callbackUrl: URL, pending: PendingLogin): Promise<OidcIdentity>;
}

export interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcIdentity {
  issuer: string;
  subject: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}
