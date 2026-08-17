// Ownership: shared Next staff shell; tenant data is supplied by admitted pages only.
import type { ReactNode } from "react";

const navItems = [
  ["Overview", "/app"], ["Schedule", "/app/schedule"], ["Customers", "/app/customers"], ["Services", "/app/services"],
  ["Resources", "/app/resources"], ["Occurrences", "/app/occurrences"], ["Feedback", "/app/feedback"],
  ["Communications", "/app/communications"], ["Industry packs", "/app/packs"], ["Pack settings", "/app/pack-settings"],
  ["QR Print Studio", "/qr-studio.html"],
] as const;

function CalendarMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>;
}

export function WorkspaceShell({ children, activeHref = "/app" }: { children: ReactNode; activeHref?: string }) {
  return <div className="app-shell workspace-shell">
    <aside className="rail workspace-rail" aria-label="Primary navigation">
      <div className="rail-header"><a className="brand" href="/app" aria-label="Niu Booking home"><span className="brand-mark"><CalendarMark /></span><span className="brand-copy"><strong>Niu <span className="brand-product">Booking</span></strong><small>Operations workspace</small></span></a></div>
      <p className="eyebrow rail-label">Workspace</p>
      <nav className="shell-nav" aria-label="Primary navigation">{navItems.map(([label, href]) => <a className={`nav-item${href === activeHref ? " active" : ""}`} aria-current={href === activeHref ? "page" : undefined} href={href} key={href}>{label}</a>)}</nav>
    </aside>
    <main className="workspace"><header className="topbar"><div className="topbar-actions"><button className="icon-button" type="button" aria-label="Search workspace">⌕</button><button className="icon-button" type="button" aria-label="Notifications">♧</button><a className="account-button" href="/auth/sign-in">Sign in</a></div></header>{children}</main>
  </div>;
}
