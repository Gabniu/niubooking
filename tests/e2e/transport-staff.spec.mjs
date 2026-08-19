import { expect, test } from "@playwright/test";

test("transport staff route exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/transport");
  await expect(page).toHaveTitle(/Transport operations/iu);
  await expect(page.getByRole("heading", { name: "Routes and trips", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a workspace to manage transport")).toBeVisible();
  expect(errors).toEqual([]);
});
