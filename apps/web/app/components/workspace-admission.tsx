// Ownership: shared tenant admission for authenticated Next workspace surfaces.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthorizedWorkspaces, type WorkspacesState } from "../../src/workspaces-client.js";
import { loadWorkspaceContext, type WorkspaceContextState } from "../../src/workspace-context.js";
import { workspaceDisplayName, workspaceReference } from "../../src/workspace-display.js";

export const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/u, "");
export type Workspaces = Extract<WorkspacesState, { kind: "ready" }>["workspaces"];
export type AdmissionState = { kind: "disconnected" | "loading"; message?: string } | WorkspaceContextState | { kind: "selecting"; workspaces: Workspaces };

function browserRequest(input: string, init: { credentials: "include" }): Promise<Response> { return window.fetch(input, init); }

export function useWorkspaceAdmission() {
  const [admission, setAdmission] = useState<AdmissionState>({ kind: "disconnected" });
  const [retryKey, setRetryKey] = useState(0);
  const tenantId = useMemo(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tenant")?.trim() ?? "", []);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setAdmission({ kind: "loading" });
    const admit = async () => {
      if (tenantId) return loadWorkspaceContext(browserRequest, apiBase, tenantId).then((state) => { if (!cancelled) setAdmission(state); });
      const result = await fetchAuthorizedWorkspaces(browserRequest, apiBase);
      if (cancelled) return;
      if (result.kind !== "ready") return setAdmission(result);
      if (result.workspaces.length === 1 && result.workspaces[0]) return loadWorkspaceContext(browserRequest, apiBase, result.workspaces[0].tenantId).then((state) => { if (!cancelled) setAdmission(state); });
      setAdmission({ kind: "selecting", workspaces: result.workspaces });
    };
    void admit().catch(() => { if (!cancelled) setAdmission({ kind: "error", message: "Your workspaces are temporarily unavailable. Please try again." }); });
    return () => { cancelled = true; };
  }, [retryKey, tenantId]);
  return { admission, retry, tenantId };
}

export function AdmissionNotice({ state, title = "Choose a workspace to continue" }: { state: AdmissionState; title?: string }) {
  const message = state.kind === "loading" ? "Connecting to your workspace..." : state.kind === "unauthenticated" || state.kind === "denied" || state.kind === "error" ? state.message : "Use NIU Auth, then choose an authorized organization and branch to continue.";
  return <section className="schedule-empty" aria-live="polite"><div className="schedule-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6V7a2 2 0 0 1 2-2Z" /></svg></div><p className="eyebrow">Workspace not connected</p><h2>{title}</h2><p>{message}</p>{state.kind !== "denied" && state.kind !== "loading" && <a className="primary-button" href="/auth/sign-in">Continue to sign in <span aria-hidden="true">-</span></a>}</section>;
}

export function WorkspacePicker({ workspaces, title = "Where would you like to work?" }: { workspaces: Workspaces; title?: string }) {
  return <section className="schedule-picker" aria-labelledby="workspace-picker-title"><div><p className="eyebrow">Authorized workspaces</p><h2 id="workspace-picker-title">{title}</h2><p>Select an organization from your live NIU Auth membership.</p></div><div className="schedule-picker-list">{workspaces.map((workspace, index) => <a className="schedule-workspace-choice" href={`${typeof window === "undefined" ? "/app" : window.location.pathname}?tenant=${encodeURIComponent(workspace.tenantId)}`} key={workspace.tenantId}><span><strong>{workspaceDisplayName(index, workspaces.length)}</strong><small>{workspace.role} / {workspace.branchIds.length} branch{workspace.branchIds.length === 1 ? "" : "es"} · {workspaceReference(workspace.tenantId)}</small></span><span aria-hidden="true">-</span></a>)}</div></section>;
}
