import { createHash } from "node:crypto";
import { Hono } from "hono";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { CustomFetch } from "openid-client";

export const ISSUER = "https://idp.test";
export const CLIENT_ID = "personalbot";

export interface IdentityClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** A minimal OpenID provider: discovery, JWKS and a token endpoint that returns a signed ID token. */
export async function createFakeIdp() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const codes = new Map<string, { claims: IdentityClaims; nonce: string; codeChallenge: string }>();
  let tokenOutage: (() => Response) | undefined;

  const app = new Hono();
  app.get("/.well-known/openid-configuration", (c) =>
    c.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    }),
  );
  app.get("/jwks", (c) => c.json({ keys: [jwk] }));
  app.post("/token", async (c) => {
    if (tokenOutage) return tokenOutage();
    const form = await c.req.parseBody();
    const grant = codes.get(String(form.code));
    if (!grant || form.client_id !== CLIENT_ID) return c.json({ error: "invalid_grant" }, 400);
    const challenge = createHash("sha256").update(String(form.code_verifier)).digest("base64url");
    if (challenge !== grant.codeChallenge) return c.json({ error: "invalid_grant", error_description: "PKCE verifier mismatch" }, 400);
    codes.delete(String(form.code));
    const idToken = await new SignJWT({ ...grant.claims, nonce: grant.nonce })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject(grant.claims.sub)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    return c.json({ access_token: "at", token_type: "Bearer", expires_in: 300, id_token: idToken });
  });

  return {
    /** Makes the token endpoint answer like a provider that is down. */
    failTokenEndpoint(response: () => Response) {
      tokenOutage = response;
    },
    fetch: (async (url, options) => app.request(new Request(url, options as RequestInit))) satisfies CustomFetch,
    /** What the IdP does after the person signs in: hands the browser a code bound to the request's nonce. */
    issueCode(authorizationUrl: URL, claims: IdentityClaims): string {
      const code = crypto.randomUUID();
      codes.set(code, {
        claims,
        nonce: authorizationUrl.searchParams.get("nonce") ?? "",
        codeChallenge: authorizationUrl.searchParams.get("code_challenge") ?? "",
      });
      return code;
    },
  };
}
