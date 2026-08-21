import { createApiServer } from "./server.js";
import { createDatabaseHealth, createDatabasePublicBookingDependencies, readApiRuntimeConfig } from "./runtime.js";
import { createAuthenticatedDependencies } from "./authenticated-context.js";
import { createDatabaseSessionStore, createLocalUserReader, createPoolExecutor, listMemberships, readMembership, withTenantTransaction } from "@bookingapp/database";
import { discoverOidcProvider, parseOptionalOidcConfig, verifyAccessToken } from "@bookingapp/auth";
import { createDatabaseAuthDependencies } from "./auth-runtime.js";

const environment = process.env.BOOKING_ENV?.trim() || "staging";
const oidcConfig = parseOptionalOidcConfig(process.env);
if (environment === "production" && !oidcConfig) throw new Error("Production startup is blocked until NOVA OIDC configuration is complete.");

const config = readApiRuntimeConfig(process.env);
const dependencies = createDatabasePublicBookingDependencies(config);
const sessions = createDatabaseSessionStore(dependencies.pool);
const auth = oidcConfig ? createDatabaseAuthDependencies(oidcConfig, dependencies.pool, sessions) : undefined;
let oidcMetadataPromise: ReturnType<typeof discoverOidcProvider> | null = null;
const accessTokenVerifier = oidcConfig ? async (token: string) => {
  oidcMetadataPromise ??= discoverOidcProvider(oidcConfig);
  try {
    const metadata = await oidcMetadataPromise;
    return verifyAccessToken(token, { issuer: metadata.issuer, audience: oidcConfig.accessTokenAudience ?? oidcConfig.clientId, jwksUri: metadata.jwksUri });
  } catch (error) { oidcMetadataPromise = null; throw error; }
} : undefined;
const authenticated = createAuthenticatedDependencies(sessions, (userId, tenantId) =>
  withTenantTransaction(dependencies.pool, tenantId, (executor) => readMembership(executor, userId, tenantId)),
  (userId) => listMemberships(createPoolExecutor(dependencies.pool), userId),
  { ...(accessTokenVerifier ? { accessTokenVerifier } : {}), ...(oidcConfig ? { accessTokenUserReader: createLocalUserReader(dependencies.pool) } : {}) },
);
const app = createApiServer({
  ...dependencies,
  ...(auth ? { auth } : {}),
  health: createDatabaseHealth(dependencies.pool),
  resolve: authenticated.resolve,
});

const port = Number(process.env.PORT ?? 3100);
const host = process.env.HOST?.trim() || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");

try {
  await app.listen({ port, host });
  console.log(`Booking API listening on ${host}:${port} (${environment})`);
} catch (error) {
  await app.close();
  await dependencies.pool.end();
  throw error;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void app.close().finally(() => dependencies.pool.end()); });
}
