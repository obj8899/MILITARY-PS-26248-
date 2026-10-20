import { expect, test, type Page } from "@playwright/test";

// WebGL runs in software here, so the run is slow but deterministic: the sim clock is real-time based.
test.use({
  viewport: { width: 1600, height: 900 },
  launchOptions: {
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});
test.setTimeout(240_000);

async function enter(page: Page, station: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/404/.test(m.text())) errors.push(m.text()); });
  await page.goto("/");
  await page.getByRole("button", { name: /Enter 3D battleground/ }).click();
  await page.getByLabel("Operator ID").fill("DSSC-0417");
  await page.locator("select").selectOption(station);
  await page.locator('input[type="password"]').fill("correct-horse-battery");
  await page.getByRole("button", { name: /Authenticate/ }).click();
  await page.waitForSelector(".bg-lobby");
  await page.locator(".toggles select").selectOption("off");
  await page.getByRole("button", { name: /DEPLOY/ }).click();
  await page.getByRole("button", { name: /Skip/ }).click();
  await page.waitForSelector(".hotbar");
  return errors;
}

test("gate rejects a short passphrase and keeps the sim offline", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Enter 3D battleground/ }).click();
  await page.getByLabel("Operator ID").fill("DSSC-0417");
  await page.locator('input[type="password"]').fill("short");
  await expect(page.getByRole("button", { name: /Authenticate/ })).toBeDisabled();
});

test("T1 never sees truth-only labels before the review", async ({ page }) => {
  const errors = await enter(page, "T1");
  await expect(page.locator(".feed")).toContainText("ADJACENT REPORT", { timeout: 120_000 }); // spoof delivered at ~H+8
  const world = await page.locator(".bg-labels").innerText();
  expect(world).not.toMatch(/TRUTH|FABRICATED|SPOOF SOURCE|INTERFERENCE ZONE|PICTURE GAP/i);
  expect(await page.locator("body").innerText()).not.toMatch(/fabricated/i);
  expect(errors).toEqual([]);
});

test("Instructor run reaches the review with an intact audit chain", async ({ page }) => {
  const errors = await enter(page, "Instructor");
  await page.getByRole("button", { name: "4×" }).click();
  await page.waitForSelector(".aar", { timeout: 150_000 });
  await expect(page.locator(".aar")).toContainText("What you knew vs what was real");
  await page.getByRole("button", { name: "Verify audit chain" }).first().click();
  await expect(page.locator(".chain").first()).toContainText("intact");
  const text = (await page.locator(".aar").innerText()).replace(/no score/i, "");
  expect(text.toLowerCase()).not.toMatch(/\bscore\b|points|rank/);
  expect(errors).toEqual([]);
});
