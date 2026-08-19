import { expect, test } from "@playwright/test";

test("public transport ticket exposes a safe unavailable state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/ticket/example-token");
  await expect(page).toHaveTitle(/Your travel ticket/iu);
  await expect(page.getByRole("heading", { name: "Your ticket", exact: true })).toBeVisible();
  await expect(page.getByText("Ticket lookup is temporarily unavailable. Please try again later.")).toBeVisible();
  expect(errors).toEqual([]);
});
