// Ownership: runtime request composition from opaque session to local tenant admission inputs.

import type { FastifyRequest } from "fastify";
import { hashSessionToken, readSessionToken, type SessionStore } from "@bookingapp/auth";
import { listMemberships, readMembership, type SqlExecutor } from "@bookingapp/database";
import type { LocalMembership } from "@bookingapp/domain";
import type { IdentityContextRequest, TenantContextDependencies } from "./server.js";

type MembershipReader = (userId: string, tenantId: string) => Promise<LocalMembership | null>;
type MembershipListReader = (userId: string) => Promise<readonly LocalMembership[]>;
type AccessTokenVerifier = (token: string) => Promise<import("@bookingapp/domain").IdentitySubject>;
type AccessTokenUserReader = (identity: import("@bookingapp/domain").IdentitySubject) => Promise<string | null>;

export interface AuthenticatedDependencyOptions { accessTokenVerifier?: AccessTokenVerifier; accessTokenUserReader?: AccessTokenUserReader; }

function bearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  if (!value?.startsWith("Bearer ") || value.length > 8192) return null;
  const token = value.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function createAuthenticatedDependencies(
  sessions: SessionStore,
  membershipSource: SqlExecutor | MembershipReader,
  membershipListReader?: MembershipListReader,
  options: AuthenticatedDependencyOptions = {},
): TenantContextDependencies {
  const membershipReader: MembershipReader = typeof membershipSource === "function"
    ? membershipSource
    : (userId, tenantId) => readMembership(membershipSource, userId, tenantId);
  const listReader = membershipListReader ?? (typeof membershipSource === "function" ? undefined : (userId: string) => listMemberships(membershipSource, userId));
  const resolveIdentity = async (request: FastifyRequest): Promise<IdentityContextRequest> => {
    const accessToken = bearerToken(request);
    if (accessToken && options.accessTokenVerifier) {
      try {
        const identity = await options.accessTokenVerifier(accessToken);
        const userId = options.accessTokenUserReader ? await options.accessTokenUserReader(identity) : null;
        return { identity, mappedUserId: userId };
      } catch { return { identity: null, mappedUserId: null }; }
    }
    if (accessToken) return { identity: null, mappedUserId: null };
    const token = readSessionToken(request.headers.cookie);
    if (!token) return { identity: null, mappedUserId: null };
    const session = await sessions.find(hashSessionToken(token));
    if (!session || session.expiresAt.getTime() <= Date.now()) return { identity: null, mappedUserId: null };
    return { identity: session.identity, mappedUserId: session.userId };
  };
  return {
    resolveIdentity,
    ...(listReader ? { workspaceReader: { list: listReader } } : {}),
    resolve: async (request: FastifyRequest<{ Params: { tenantId: string } }>) => {
      const identity = await resolveIdentity(request);
      if (!identity.identity || !identity.mappedUserId) return { ...identity, membership: null, requestedTenantId: request.params.tenantId };
      const membership = await membershipReader(identity.mappedUserId, request.params.tenantId);
      return { ...identity, membership, requestedTenantId: request.params.tenantId };
    },
  };
}
