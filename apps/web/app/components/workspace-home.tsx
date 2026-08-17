// Ownership: first real Next staff surface; navigation remains honest while workspace admission is wired.
import { WorkspaceShell } from "./workspace-shell.js";
import { WorkspaceHomeState } from "./workspace-home-state.js";

export function WorkspaceHome() {
  return <WorkspaceShell><section className="workspace-content" id="overview"><header className="page-intro"><div><p className="eyebrow">Operations workspace</p><h1>Bring your service work into focus.</h1><p className="intro-copy">Choose an authorized organization to load its schedule, customers, services, and resources.</p></div><a className="primary-button" href="/app/schedule">Open schedule</a></header><WorkspaceHomeState /></section></WorkspaceShell>;
}
