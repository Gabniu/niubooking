import { expect, test } from "@playwright/test";

test("public transport exposes a safe unavailable state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/trip/example-code");
  await expect(page).toHaveTitle(/Choose your trip/iu);
  await expect(page.getByRole("heading", { name: "Choose your trip", exact: true })).toBeVisible();
  await expect(page.getByText("Transport booking is temporarily unavailable. Please try again later.")).toBeVisible();
  expect(errors).toEqual([]);
});
