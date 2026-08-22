// Ownership: NIU Driver build configuration. Public OIDC metadata is injected at build time; secrets are not.

import type { ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext) => ({
  ...config,
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    telemetryEndpoint: process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT,
    authIssuer: process.env.EXPO_PUBLIC_AUTH_ISSUER,
    authClientId: process.env.EXPO_PUBLIC_AUTH_CLIENT_ID,
    authRedirectUri: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URI,
    authRefreshEnabled: process.env.EXPO_PUBLIC_AUTH_REFRESH_ENABLED === 'true',
  },
});
