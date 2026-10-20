import { expect, test, type Page } from "@playwright/test";

async function skipFirstVisitTour(page: Page) {
  const skip = page.getByRole("button", { name: "Skip" });
  await page.waitForTimeout(80);
  if (await skip.isVisible()) await skip.click();
}

test("SILENT RIDGE rehearsal actions are idempotent and trainee view omits truth markers", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await page.getByRole("button", { name: "Begin exercise" }).click();
  await skipFirstVisitTour(page);

  await expect(page.getByRole("heading", { name: "Configure communication conditions" })).toBeVisible();
  await expect(page.locator(".seat-chip")).toContainText("T1 · Coy Cdr");
  await expect(page.getByText("Waiting").first()).toBeVisible();
  await page.getByRole("button", { name: /Mark all ready/ }).click();
  await expect(page.getByText("Ready").first()).toBeVisible();

  await page.getByRole("button", { name: "Start Exercise" }).click();
  await skipFirstVisitTour(page);
  await page.getByRole("button", { name: "Acknowledge" }).click();
  await skipFirstVisitTour(page);

  await page.getByRole("button", { name: /^Jam Net/ }).click();
  await page.getByRole("button", { name: /^Jam Net/ }).click();
  await page.getByRole("button", { name: /^Spoof Contact/ }).click();

  await page.getByRole("button", { name: "Open rehearsal menu" }).click();
  await page.getByRole("button", { name: "T1", exact: true }).click();
  await skipFirstVisitTour(page);
  await expect(page.getByText("T1 console")).toBeVisible();
  const traineeText = await page.locator("body").innerText();
  expect(traineeText.toLowerCase()).not.toContain("fabricated");
  expect(traineeText).not.toContain("Hostile vehicle element");
  await expect(page.getByLabel("Contradictory reports")).toBeVisible();
  await page.locator(".feed-card").filter({ hasText: "ADJACENT REPORT" }).getByRole("button", { name: "Verify" }).click();

  await page.getByRole("button", { name: "Submit decision" }).click();
  await expect(page.getByRole("heading", { name: "What happened and why" })).toBeVisible({ timeout: 10_000 });
  await skipFirstVisitTour(page);
  const reel = page.getByRole("region", { name: "Key moments reel" });
  await expect(reel).toContainText("First delayed report");
  for (let index = 0; index < 3; index += 1) await reel.getByRole("button", { name: "Next moment" }).click();
  await expect(reel).toContainText("Decision submitted");
  await reel.getByRole("button", { name: "Next moment" }).click();
  await reel.getByRole("button", { name: "Next moment" }).click();
  await expect(reel).toContainText("Branch consequence");
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();

  await page.getByRole("button", { name: "Open rehearsal menu" }).click();
  await page.getByRole("button", { name: "Instructor", exact: true }).click();
  await page.getByLabel("Auto-Director (Rule-based automation)").check();
  await expect(page.getByLabel("Auto-Director (Rule-based automation)")).toBeChecked();
  await page.getByRole("button", { name: "Run log", exact: true }).click();
  const titles = await page.locator('[data-testid="run-log"] .log-row').evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-log-title"))
  );
  expect(titles.filter((title) => title === "CreateSession")).toHaveLength(1);
  expect(titles.filter((title) => title === "BriefIssued")).toHaveLength(1);
  expect(titles.filter((title) => title === "FireInject:JAM_NET")).toHaveLength(1);
  expect(titles.filter((title) => title === "AutoDirectorToggled")).toHaveLength(1);
  expect(new Set(titles).size).toBe(titles.length);
  await expect(page.locator('[data-testid="run-log"]')).toContainText("Instructor");
  expect(pageErrors).toEqual([]);

  await page.getByRole("button", { name: "Open rehearsal menu" }).click();
  await page.getByRole("button", { name: "Scenario Builder", exact: true }).click();
  await skipFirstVisitTour(page);
  await page.getByRole("button", { name: "Validate & save" }).click();
  await expect(page.getByRole("status")).toContainText("Saved Exercise SILENT RIDGE");
  await page.getByRole("button", { name: "Open rehearsal menu" }).click();
  await page.getByRole("button", { name: "Landing", exact: true }).click();
  await expect(page.locator(".custom-scenario-strip")).toContainText("Exercise SILENT RIDGE");

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  }

  await page.getByRole("button", { name: /Take the 2-minute field guide/ }).click();
  await skipFirstVisitTour(page);
  await expect(page.getByRole("heading", { name: "Communication effects" })).toBeVisible();
  await expect(page.getByLabel("Sample report delay")).toBeVisible();
  await page.getByRole("button", { name: "Next guide step" }).click();
  await page.getByLabel("Sample source grade").selectOption("D");
  await expect(page.getByText(/Sample report grade: D/)).toBeVisible();
  await page.getByRole("button", { name: "Next guide step" }).click();
  await page.getByLabel("Show the two stream labels").check();
  await expect(page.getByText("T1 · perceived report feed")).toBeVisible();
  await page.getByRole("button", { name: "Next guide step" }).click();
  await page.getByLabel("Sample decision deadline").selectOption("4");
  await expect(page.getByText(/If no choice is recorded by H\+4/)).toBeVisible();
  await page.getByRole("button", { name: "Next guide step" }).click();
  await expect(page.getByRole("button", { name: "Start Judge walkthrough" })).toBeVisible();
  await page.getByRole("button", { name: "Start Judge walkthrough" }).click();
  await expect(page.locator(".judge-walkthrough-card")).toContainText("STEP 1 OF 7");
  await expect(page.getByRole("heading", { name: "Director's script" })).toBeVisible();
  await page.getByRole("button", { name: "Skip walkthrough" }).click();
});
