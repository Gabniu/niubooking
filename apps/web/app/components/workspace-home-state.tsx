// Ownership: client-side tenant admission presentation; it never fabricates workspace data.
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { BookingIllustration } from "./booking-illustration.js";
import { loadWorkspaceContext, type WorkspaceContextState } from "../../src/workspace-context.js";
import { fetchAuthorizedWorkspaces, type WorkspacesState } from "../../src/workspaces-client.js";
import { workspaceDisplayName, workspaceReference } from "../../src/workspace-display.js";

type WorkspaceState =
  | { kind: "disconnected" | "loading"; message?: string }
  | WorkspaceContextState
  | { kind: "selecting"; workspaces: Extract<WorkspacesState, { kind: "ready" }>["workspaces"] };

const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

function DisconnectedState({ state }: { state: WorkspaceState }) {
  if (state.kind === "selecting") return <WorkspacePicker workspaces={state.workspaces} />;
  const message = state.kind === "loading" ? "Connecting to your workspace…" : state.kind === "unauthenticated" ? "Your session is not connected yet." : state.kind === "denied" ? state.message : state.kind === "error" ? state.message : "Use NIU Auth, then choose an authorized organization and branch. Your live operational data will appear here without sample records.";
  const showSignIn = state.kind !== "denied";
  return <section className="empty-state" aria-labelledby="welcome-title"><div className="empty-state-copy"><div className="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg></div><p className="eyebrow">{state.kind === "denied" ? "Workspace access" : "Workspace not connected"}</p><h2 id="welcome-title">{state.kind === "denied" ? "This workspace is unavailable" : state.kind === "loading" ? "Loading your workspace" : "Sign in to load your bookings"}</h2><p className="empty-copy">{message}</p>{showSignIn && <div className="empty-actions"><a className="primary-button" href="/auth/sign-in">Continue to sign in <span aria-hidden="true">→</span></a><a className="account-button" href="/">View public experience</a></div>}<p className="state-note">No customers, metrics, or appointments are shown until a workspace is authorized.</p></div><div className="empty-illustration" aria-hidden="true"><BookingIllustration id="login" alt="" loading="eager" /></div></section>;
}

function WorkspacePicker({ workspaces }: { workspaces: Extract<WorkspacesState, { kind: "ready" }>["workspaces"] }) {
  return <section className="workspace-picker" aria-labelledby="workspace-picker-title"><div><p className="eyebrow">Choose a workspace</p><h2 id="workspace-picker-title">Where would you like to work?</h2><p className="empty-copy">Select an organization you are authorized to access. Branch access and role are shown from your live account.</p></div><div className="workspace-picker-list">{workspaces.map((workspace, index) => <a className="workspace-choice" href={`?tenant=${encodeURIComponent(workspace.tenantId)}`} key={workspace.tenantId}><span><strong>{workspaceDisplayName(index, workspaces.length)}</strong><small>{workspace.role} · {workspace.branchIds.length} branch{workspace.branchIds.length === 1 ? "" : "es"} · {workspaceReference(workspace.tenantId)}</small></span><span aria-hidden="true">→</span></a>)}</div></section>;
}

function ConnectedState({ state }: { state: Extract<WorkspaceState, { kind: "ready" }> }) {
  return <section className="connected-state" aria-labelledby="connected-title"><div className="connected-state-heading"><div><p className="eyebrow">Workspace connected</p><h2 id="connected-title">Your authorized organization</h2><small>{workspaceReference(state.tenantId)}</small></div><span className="connected-badge">Live context</span></div><p className="connected-copy">Signed in as {state.role} across {state.branchCount} branch{state.branchCount === 1 ? "" : "es"}. Your workspace is now using the shared booking kernel.</p>{state.pack ? <div className="pack-context" style={{ "--pack-accent": state.pack.theme.accent, "--pack-soft": state.pack.theme.accentSoft } as CSSProperties}><div><p className="eyebrow">Active industry pack</p><strong>{state.pack.displayName}</strong><small>{state.pack.serviceTemplates.length} service template{state.pack.serviceTemplates.length === 1 ? "" : "s"} · {state.pack.resourceTypes.length} resource type{state.pack.resourceTypes.length === 1 ? "" : "s"}</small></div><span className="pack-swatch" aria-hidden="true" /></div> : <p className="connected-note">No industry pack is selected yet. Configure one when your organization is ready.</p>}<div className="connected-actions"><a className="primary-button" href="/app/schedule">Open schedule</a><a className="account-button" href="/app/pack-settings">Pack settings</a></div></section>;
}

export function WorkspaceHomeState() {
  const [state, setState] = useState<WorkspaceState>({ kind: "disconnected" });
  useEffect(() => {
    if (!apiBase) return;
    const fetcher = window.fetch.bind(window);
    const tenantId = new URLSearchParams(window.location.search).get("tenant")?.trim();
    const load = (selectedTenantId: string) => { setState({ kind: "loading" }); void loadWorkspaceContext(fetcher, apiBase, selectedTenantId).then(setState).catch(() => setState({ kind: "error", message: "We could not connect to this workspace. Please try again." })); };
    if (tenantId) return load(tenantId);
    setState({ kind: "loading" });
    void fetchAuthorizedWorkspaces(fetcher, apiBase).then((result) => {
      if (result.kind !== "ready") return setState(result);
      const first = result.workspaces[0];
      if (first && result.workspaces.length === 1) return load(first.tenantId);
      setState({ kind: "selecting", workspaces: result.workspaces });
    }).catch(() => setState({ kind: "error", message: "Your workspaces are temporarily unavailable. Please try again." }));
  }, []);
  return state.kind === "ready" ? <ConnectedState state={state} /> : <DisconnectedState state={state} />;
}
