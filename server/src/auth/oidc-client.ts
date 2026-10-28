import * as client from "openid-client";
import type { OidcIdentity, OidcProvider, PendingLogin } from "./oidc.ts";

export interface OpenIdSettings {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

/** The OidcProvider adapter over openid-client. Discovery runs on first use and is retried after a failure. */
export function createOpenIdProvider(settings: OpenIdSettings, { fetch }: { fetch?: client.CustomFetch } = {}): OidcProvider {
  let configuration: Promise<client.Configuration> | undefined;
  const configure = () =>
    (configuration ??= discover(settings, fetch).catch((error: unknown) => {
      configuration = undefined;
      throw error;
    }));

  return {
    redirectUri: settings.redirectUri,

    async start() {
      const config = await configure();
      const pending: PendingLogin = { state: client.randomState(), nonce: client.randomNonce(), codeVerifier: client.randomPKCECodeVerifier() };
      const url = client.buildAuthorizationUrl(config, {
        redirect_uri: settings.redirectUri,
        scope: "openid email profile",
        code_challenge: await client.calculatePKCECodeChallenge(pending.codeVerifier),
        code_challenge_method: "S256",
        state: pending.state,
        nonce: pending.nonce,
      });
      return { url, pending };
    },

    async finish(callbackUrl, pending) {
      const tokens = await client.authorizationCodeGrant(await configure(), callbackUrl, {
        pkceCodeVerifier: pending.codeVerifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) throw new Error("The provider returned no ID token.");
      const identity: OidcIdentity = { issuer: claims.iss, subject: claims.sub };
      if (typeof claims.email === "string") identity.email = claims.email;
      if (typeof claims.email_verified === "boolean") identity.emailVerified = claims.email_verified;
      if (typeof claims.name === "string") identity.name = claims.name;
      return identity;
    },
  };
}

async function discover(settings: OpenIdSettings, fetch: client.CustomFetch | undefined): Promise<client.Configuration> {
  const authentication = settings.clientSecret ? client.ClientSecretPost(settings.clientSecret) : client.None();
  const config = await client.discovery(
    new URL(settings.issuer),
    settings.clientId,
    undefined,
    authentication,
    fetch ? { [client.customFetch]: fetch } : undefined,
  );
  if (fetch) config[client.customFetch] = fetch;
  return config;
}
