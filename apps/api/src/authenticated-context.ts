// Ownership: runtime request composition from opaque session to local tenant admission inputs.

import type { FastifyRequest } from "fastify";
import { hashSessionToken, readSessionToken, type SessionStore } from "@bookingapp/auth";
import { listMemberships, readMembership, type SqlExecutor } from "@bookingapp/database";
import type { LocalMembership } from "@bookingapp/domain";
import type { IdentityContextRequest, TenantContextDependencies } from "./server.js";

type MembershipReader = (userId: string, tenantId: string) => Promise<LocalMembership | null>;
type MembershipListReader = (userId: string) => Promise<readonly LocalMembership[]>;

export function createAuthenticatedDependencies(
  sessions: SessionStore,
  membershipSource: SqlExecutor | MembershipReader,
  membershipListReader?: MembershipListReader,
): TenantContextDependencies {
  const membershipReader: MembershipReader = typeof membershipSource === "function"
    ? membershipSource
    : (userId, tenantId) => readMembership(membershipSource, userId, tenantId);
  const listReader = membershipListReader ?? (typeof membershipSource === "function" ? undefined : (userId: string) => listMemberships(membershipSource, userId));
  const resolveIdentity = async (request: FastifyRequest): Promise<IdentityContextRequest> => {
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
