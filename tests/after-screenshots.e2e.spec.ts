import { expect, test, type Page } from "@playwright/test";

const screens = [
  "Landing",
  "Field guide",
  "Setup",
  "Brief",
  "Instructor",
  "T1",
  "T2",
  "T3",
  "AAR",
  "End card",
  "Scenario Builder",
];

async function skipTour(page: Page) {
  const skip = page.getByRole("button", { name: "Skip" });
  if (await skip.isVisible()) await skip.click();
}

test("captures every screen at 1920x1080 and 1366x768", async ({ page }) => {
  await page.goto("/");
  await skipTour(page);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const screen of screens) {
      if (screen !== "Landing") {
        await page.getByRole("button", { name: "Open rehearsal menu" }).click();
        await page.locator(".rehearsal-menu").getByRole("button", { name: screen, exact: true }).click();
        await skipTour(page);
      }

      await expect(page.getByText("Illustrative simulation · scripted exercise", { exact: false }).first()).toBeVisible();
      await page.screenshot({
        path: `docs/screens/after/${viewport.width}x${viewport.height}-${screen.toLowerCase().replace(/\s+/g, "-")}.png`,
        animations: "disabled",
      });
    }
  }
});
