// Ownership: frontend client for the authorized workspace list; it never trusts a tenant id from the browser.

import { authorizedWorkspacesPath, type AuthorizedWorkspacesResponse } from "@bookingapp/contracts";
import { userFacingMessage } from "./user-messages.js";

export interface WorkspacesResponseLike { ok: boolean; status: number; json(): Promise<unknown>; }
export type WorkspacesFetcher = (input: string, init: { credentials: "include" }) => Promise<WorkspacesResponseLike>;
export type WorkspacesState =
  | { kind: "ready"; workspaces: NonNullable<AuthorizedWorkspacesResponse["data"]> }
  | { kind: "unauthenticated" | "error"; message: string };

export async function fetchAuthorizedWorkspaces(fetcher: WorkspacesFetcher, baseUrl: string): Promise<WorkspacesState> {
  const response = await fetcher(`${baseUrl}${authorizedWorkspacesPath()}`, { credentials: "include" });
  const body = (await response.json()) as AuthorizedWorkspacesResponse;
  if (body.data) return { kind: "ready", workspaces: body.data };
  if (body.error?.code === "UNAUTHENTICATED") return { kind: "unauthenticated", message: userFacingMessage(response.status, body.error, "Sign in to choose a workspace.") };
  return { kind: "error", message: userFacingMessage(response.status, body.error, "Your workspaces are temporarily unavailable.") };
}
