// Ownership: NIU Driver app edge. OIDC browser exchange stays out of the shared tracking core.

import * as AuthSession from 'expo-auth-session';
import type {
  NativeAuthSession,
  NativeAuthSnapshot,
} from '@bookingapp/driver-tracking';
import type { DriverRuntimeConfig } from './config';
import type { NativeRefreshTokenStorage } from './native-auth-storage';

type DiscoveryDocument = AuthSession.DiscoveryDocument & {
  readonly discoveryDocument: AuthSession.ProviderMetadata;
};

export interface NativeOidcClient {
  signIn(): Promise<NativeAuthSnapshot>;
  refresh(): Promise<NativeAuthSnapshot>;
}

type OidcFetcher = (input: string, init?: RequestInit) => Promise<Response>;

function normalizedIssuer(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('NOVA Auth issuer configuration is unsafe');
  }
  return url.toString().replace(/\/$/u, '');
}

function discoveryUrl(issuer: string): string {
  const url = new URL(issuer);
  const path = url.pathname.replace(/\/+$/u, '');
  return `${url.origin}/.well-known/openid-configuration${path}`;
}

function httpsEndpoint(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`NOVA Auth discovery is missing ${label}`);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('NOVA Auth discovery contains an unsafe endpoint');
  }
  return url.toString();
}

function accessCredential(token: AuthSession.TokenResponse): { accessToken: string; expiresAt: string } {
  if (!token.accessToken || !token.expiresIn || !Number.isFinite(token.expiresIn) || token.expiresIn <= 0) {
    throw new Error('NOVA Auth returned an unusable access token');
  }
  return {
    accessToken: token.accessToken,
    expiresAt: new Date(Date.now() + token.expiresIn * 1000).toISOString(),
  };
}

function isInvalidGrant(error: unknown): boolean {
  return error instanceof AuthSession.TokenError && error.params.error === 'invalid_grant';
}

async function discover(config: DriverRuntimeConfig, fetcher: OidcFetcher): Promise<DiscoveryDocument> {
  const issuer = normalizedIssuer(config.authIssuer);
  const response = await fetcher(discoveryUrl(issuer), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('NOVA Auth is unavailable');
  const document = await response.json() as Record<string, unknown>;
  if (normalizedIssuer(String(document.issuer ?? '')) !== issuer) {
    throw new Error('NOVA Auth issuer mismatch');
  }
  const methods = document.code_challenge_methods_supported;
  if (!Array.isArray(methods) || !methods.includes('S256')) {
    throw new Error('NOVA Auth does not support S256 PKCE');
  }
  return {
    authorizationEndpoint: httpsEndpoint(document.authorization_endpoint, 'authorization endpoint'),
    tokenEndpoint: httpsEndpoint(document.token_endpoint, 'token endpoint'),
    discoveryDocument: document as AuthSession.ProviderMetadata,
  };
}

export function createNativeOidcClient(
  config: DriverRuntimeConfig,
  auth: NativeAuthSession,
  refreshStorage: NativeRefreshTokenStorage,
  fetcher: OidcFetcher = fetch,
): NativeOidcClient {
  return {
    async signIn() {
      const discovery = await discover(config, fetcher);
      const request = new AuthSession.AuthRequest({
        clientId: config.authClientId,
        redirectUri: config.authRedirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: config.authRefreshEnabled ? ['openid', 'profile', 'offline_access'] : ['openid', 'profile'],
        codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        usePKCE: true,
        prompt: AuthSession.Prompt.SelectAccount,
      });
      const result = await request.promptAsync(discovery);
      if (result.type !== 'success' || !result.params.code) {
        throw new Error('Sign-in was not completed');
      }
      if (!request.codeVerifier) throw new Error('Sign-in could not establish PKCE');

      const token = await AuthSession.exchangeCodeAsync({
        clientId: config.authClientId,
        code: result.params.code,
        redirectUri: config.authRedirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      }, discovery);
      const credential = accessCredential(token);
      if (config.authRefreshEnabled) {
        if (!token.refreshToken) throw new Error('NOVA Auth did not return a refresh token');
        await refreshStorage.write(token.refreshToken);
      } else {
        await refreshStorage.clear();
      }
      return auth.setCredential(credential);
    },
    async refresh() {
      if (!config.authRefreshEnabled) throw new Error('Native token refresh is not enabled');
      const refreshToken = await refreshStorage.read();
      if (!refreshToken) throw new Error('Native token refresh is unavailable');
      try {
        const discovery = await discover(config, fetcher);
        const token = await AuthSession.refreshAsync({
          clientId: config.authClientId,
          refreshToken,
          scopes: ['openid', 'profile'],
        }, discovery);
        const credential = accessCredential(token);
        await refreshStorage.write(token.refreshToken ?? refreshToken);
        return auth.setCredential(credential);
      } catch (error) {
        if (isInvalidGrant(error)) {
          await Promise.all([refreshStorage.clear(), auth.clear()]);
        }
        throw new Error('Native session refresh could not be completed');
      }
    },
  };
}
