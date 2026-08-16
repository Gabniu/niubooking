// Ownership: authenticated staff entry; tenant data stays absent until admission.
import type { Metadata } from "next";
import { WorkspaceHome } from "../components/workspace-home.js";

export const metadata: Metadata = { title: "Operations workspace" };

export default function WorkspacePage() {
  return <WorkspaceHome />;
}
