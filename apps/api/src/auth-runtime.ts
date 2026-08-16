// Ownership: composition of the OIDC routes with Booking persistence boundaries.

import type { Pool } from "pg";
import { createLocalUserReader } from "@bookingapp/database";
import { createMemoryOidcStateStore } from "./oidc-state.js";
import type { OidcConsumerConfig, SessionStore } from "@bookingapp/auth";
import { registerAuthRoutes, type AuthRouteDependencies } from "./auth-routes.js";

export function createDatabaseAuthDependencies(config: OidcConsumerConfig, pool: Pool, sessions: SessionStore): AuthRouteDependencies {
  return { config, sessions, state: createMemoryOidcStateStore(), readLocalUser: createLocalUserReader(pool) };
}

export { registerAuthRoutes };
