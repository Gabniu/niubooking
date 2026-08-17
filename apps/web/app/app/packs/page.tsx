// Ownership: real Next catalog surface for code-reviewed, universal industry packs.
import type { Metadata } from "next";
import { defaultIndustryPackRegistry } from "@bookingapp/domain";
import { PackCatalog } from "../../components/pack-catalog.js";
import { WorkspaceShell } from "../../components/workspace-shell.js";

export const metadata: Metadata = { title: "Industry packs" };

export default function IndustryPacksPage() {
  const packs = defaultIndustryPackRegistry.list();
  return <WorkspaceShell activeHref="/app/packs"><section className="workspace-content pack-catalog-page"><header className="page-intro"><div><p className="eyebrow">Platform composition</p><h1>Industry packs</h1><p className="intro-copy">One booking kernel, with vocabulary and defaults that fit the work your team actually does.</p></div><a className="account-button" href="/app/pack-settings">Configure a workspace</a></header><PackCatalog packs={packs} /></section></WorkspaceShell>;
}
