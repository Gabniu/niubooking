import { expect, test } from "@playwright/test";

test("public homepage separates prospects from the staff workspace", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page).toHaveTitle(/Service work, made clear/iu);
  await expect(page.getByRole("heading", { name: "Make every booking feel easy to keep." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start with Booking/iu })).toHaveAttribute("href", "/auth/sign-in");
  await expect(page.getByText("Service. Reservation. Resources.")).toBeVisible();
  await expect(page.getByRole("img", { name: "A booking workflow being arranged" })).toBeVisible();
});

test("auth entry explains its server configuration honestly", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await expect(page.getByText(/Use your NIU Auth account to access your authorized organizations/iu)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with NIU Auth" })).toBeVisible();
});

test("staff entry exposes real navigation and an honest disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/app.html");
  await expect(page).toHaveTitle(/Booking/iu);
  await expect(page.getByRole("heading", { name: "Bring your service work into focus." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to load your bookings" })).toBeVisible();
  await expect(page.locator('img[src="/illustrations/login.svg"]')).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) > 700) {
    await expect(page.getByRole("link", { name: "Schedule", exact: true })).toHaveAttribute("href", "/app/schedule");
    await expect(page.getByRole("link", { name: "Customers", exact: true })).toHaveAttribute("href", "/app/customers");
    await expect(page.getByRole("link", { name: "Services", exact: true })).toHaveAttribute("href", "/app/services");
    await expect(page.getByRole("link", { name: "Occurrences" })).toHaveAttribute("href", "/occurrences.html");
    await expect(page.getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/resources.html");
  }
  await expect(page.getByText("No customers, metrics, or appointments are shown until a workspace is authorized.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Next schedule exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/schedule");
  await expect(page).toHaveTitle(/Schedule/iu);
  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a workspace to see the schedule")).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to sign in/iu })).toHaveAttribute("href", "/auth/sign-in");
  expect(errors).toEqual([]);
});

test("Next customers exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/customers");
  await expect(page).toHaveTitle(/Customers/iu);
  await expect(page.getByRole("heading", { name: "Customers", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a workspace to manage customers")).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to sign in/iu })).toHaveAttribute("href", "/auth/sign-in");
  expect(errors).toEqual([]);
});

test("Next services exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/services");
  await expect(page).toHaveTitle(/Services/iu);
  await expect(page.getByRole("heading", { name: "Services", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a workspace to manage services")).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to sign in/iu })).toHaveAttribute("href", "/auth/sign-in");
  expect(errors).toEqual([]);
});

test("workspace shell remains usable at compact widths", async ({ page }) => {
  await page.goto("/app.html");
  await expect(page.locator(".app-shell")).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport?.width).toBeGreaterThan(300);
  if ((viewport?.width ?? 0) > 700) {
    await expect(page.getByRole("button", { name: "Search workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open schedule" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Bring your service work into focus." })).toBeVisible();
  }
});

test("Next staff shell exposes the universal industry-pack catalog", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/packs");
  await expect(page).toHaveTitle(/Industry packs/iu);
  await expect(page.getByRole("heading", { name: "Industry packs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hospital" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fitness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Charter" })).toBeVisible();
  await expect(page.getByText("shared scheduling, reservation, resource, reminder, QR, and feedback rules remain consistent.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configure a workspace" })).toHaveAttribute("href", "/pack-settings.html");
  expect(errors).toEqual([]);
});

test("public booking page exposes a recoverable missing-code state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/guest-booking.html");
  await expect(page.getByRole("heading", { name: "Reserve a time" })).toBeVisible();
  await expect(page.getByText("This booking link is missing its code.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("public occurrence page exposes a recoverable missing-code state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/guest-occurrence.html");
  await expect(page.getByRole("heading", { name: "Reserve a place" })).toBeVisible();
  await expect(page.getByText("This booking link is missing its code.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("occurrence workspace exposes a safe disconnected staff state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/occurrences.html");
  await expect(page.getByRole("heading", { name: "Occurrences" })).toBeVisible();
  await expect(page.getByText("Choose an authorized workspace before managing occurrences.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("QR Print Studio exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/qr-studio.html");
  await expect(page.getByRole("heading", { name: "QR Print Studio" })).toBeVisible();
  await expect(page.getByText("Choose an authorized workspace before managing QR destinations.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("Services workspace exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/services.html");
  await expect(page.getByRole("heading", { name: "Services", exact: true })).toBeVisible();
  await expect(page.getByText("Choose an authorized workspace before managing services.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Service composition exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/service-composition.html");
  await expect(page.getByRole("heading", { name: "Variants & requirements" })).toBeVisible();
  await expect(page.getByText("Choose an authorized workspace and service before configuring variants.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Industry pack catalog exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/packs.html");
  await expect(page.getByRole("heading", { name: "Industry packs" })).toBeVisible();
  await expect(page.getByText("Connect the API to inspect the available industry packs.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Pack settings exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/pack-settings.html");
  await expect(page.getByRole("heading", { name: "Industry pack" })).toBeVisible();
  await expect(page.getByText("Connect an authorized workspace and API before changing its industry pack.")).toBeVisible();
  expect(errors).toEqual([]);
});
