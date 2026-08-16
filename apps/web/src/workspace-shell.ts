// Ownership: shared Booking shell. Keeps every authenticated workspace page aligned with NOVA Auth.

type NavItem = { href: string; label: string; path: string; icon: string };

const items: readonly NavItem[] = [
  { href: "./app.html", label: "Overview", path: "app.html", icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" },
  { href: "./bookings.html", label: "Schedule", path: "bookings.html", icon: "M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" },
  { href: "./customers.html", label: "Customers", path: "customers.html", icon: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 18.5V20m5.5-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm5-5.5a2.5 2.5 0 0 1 0 5M16 15h1a3 3 0 0 1 3 3v2" },
  { href: "./services.html", label: "Services", path: "services.html", icon: "M4 7h16M4 12h16M4 17h10M7 4v6m10-6v6" },
  { href: "./resources.html", label: "Resources", path: "resources.html", icon: "M4 6h16M4 12h16M4 18h10M7 3v6m10 6v6" },
  { href: "./occurrences.html", label: "Occurrences", path: "occurrences.html", icon: "M4 5h16v14H4V5Zm4 4h8M8 13h5M8 16h3" },
  { href: "./feedback-admin.html", label: "Feedback", path: "feedback-admin.html", icon: "M5 5h14v11H9l-4 4V5Zm4 5h6m-6 3h4" },
  { href: "./communications.html", label: "Communications", path: "communications.html", icon: "M5 5h14v10a2 2 0 0 1-2 2H9l-4 3V5Zm3 4h8m-8 3h5" },
  { href: "./packs.html", label: "Industry packs", path: "packs.html", icon: "m12 3 8 4v10l-8 4-8-4V7l8-4Zm0 0v18M4 7l8 4 8-4" },
  { href: "./pack-settings.html", label: "Pack settings", path: "pack-settings.html", icon: "M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h5" },
  { href: "./qr-studio.html", label: "QR Print Studio", path: "qr-studio.html", icon: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 3h2m2-3v6h2m-4-3h2" },
];

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
  node.setAttribute("d", path);
  svg.append(node);
  return svg;
}

function brand(): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "brand";
  link.href = "./app.html";
  link.setAttribute("aria-label", "Niu Booking home");
  const mark = document.createElement("span");
  mark.className = "brand-mark";
  mark.append(icon("M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"));
  const copy = document.createElement("span");
  copy.className = "brand-copy";
  const name = document.createElement("strong");
  name.append("Niu ");
  const product = document.createElement("span");
  product.className = "brand-product";
  product.textContent = "Booking";
  name.append(product);
  const detail = document.createElement("small");
  detail.textContent = "Operations workspace";
  copy.append(name, detail);
  link.append(mark, copy);
  return link;
}

function navigation(mobile = false): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = mobile ? "shell-mobile-nav" : "shell-nav";
  nav.setAttribute("aria-label", mobile ? "Workspace navigation" : "Primary navigation");
  const current = location.pathname.split("/").pop() || "app.html";
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "nav-item";
    link.href = item.href;
    link.append(icon(item.icon));
    const label = document.createElement("span");
    label.textContent = item.label;
    link.append(label);
    if (current === item.path) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    nav.append(link);
  }
  return nav;
}

function rail(): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "rail workspace-rail";
  aside.setAttribute("aria-label", "Primary navigation");
  const header = document.createElement("div");
  header.className = "rail-header";
  header.append(brand());
  const label = document.createElement("p");
  label.className = "eyebrow rail-label";
  label.textContent = "Workspace";
  aside.append(header, label, navigation());
  return aside;
}

function pointBackToWorkspace(page: HTMLElement): void {
  for (const link of page.querySelectorAll<HTMLAnchorElement>('a[href="./index.html"]')) {
    if (link.textContent?.toLowerCase().includes("back to workspace")) link.href = "./app.html";
  }
}

function install(): void {
  const page = document.querySelector<HTMLElement>("main.workspace");
  if (!page || page.classList.contains("guest-booking-page") || page.querySelector(".verification-card")) return;
  const existingShell = document.querySelector<HTMLElement>(".app-shell");
  if (existingShell) {
    const existingNavigation = existingShell.querySelector("aside .shell-nav");
    if (existingNavigation) existingNavigation.replaceWith(navigation());
    if (!existingShell.querySelector(".shell-mobile-nav")) existingShell.insertBefore(navigation(true), page);
    pointBackToWorkspace(existingShell);
    document.body.classList.add("booking-workspace-page");
    return;
  }
  const shell = document.createElement("div");
  shell.className = "app-shell workspace-shell";
  shell.append(rail(), navigation(true), page);
  pointBackToWorkspace(page);
  document.body.classList.add("booking-workspace-page");
  document.body.prepend(shell);
}

install();
