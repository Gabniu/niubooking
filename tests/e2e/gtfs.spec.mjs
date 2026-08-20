import { expect, test } from "@playwright/test";

test("GTFS publication route exposes a safe disconnected state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/gtfs");
  await expect(page).toHaveTitle(/Transit publication/iu);
  await expect(page.getByRole("heading", { name: "Schedule publication", exact: true })).toBeVisible();
  await expect(page.getByText("Choose a workspace to review transit publication")).toBeVisible();
  expect(errors).toEqual([]);
});
