/** Port to an OpenID Connect provider, so sign-in works with Google, Entra, Keycloak or any other. */
export interface OidcProvider {
  redirectUri: string;
  /** Where to send the browser, and the values the callback must be checked against. */
  start(): Promise<{ url: URL; pending: PendingLogin }>;
  /**
   * Checks the callback against pending and returns who signed in; throws when anything does not match.
   * Throws ProviderUnavailableError instead when the provider could not be reached.
   */
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

/** The provider could not be reached or answered with something other than OAuth; not the person's fault. */
export class ProviderUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`The sign-in provider is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}
