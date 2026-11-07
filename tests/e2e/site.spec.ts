import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const doctor = {
  npi: "1770664856", name: "Fixture Provider, MD", specialty: "Family Medicine",
  address1: "100 Test Street", city: "Chicago", state: "IL", zip: "60614",
  phone: "312-555-0100", lat: 41.92, lng: -87.65, distanceMi: 1.2,
  practiceLocations: [{ address1: "100 Test Street", city: "Chicago", state: "IL", zip: "60614", phone: "312-555-0100" }, { address1: "200 Test Street", city: "Chicago", state: "IL", zip: "60614", phone: "312-555-0200" }],
  locationApproximate: false, sourceUpdatedAt: "2026-01-01",
  coverage: { status: "unknown", label: "Unable to verify Original Medicare assignment", source: "Official Medicare data", checkedAt: "2026-10-05T12:00:00Z" },
};
test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", route => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBWQAAAAASUVORK5CYII=", "base64") }));
});
test("homepage paints without JavaScript or external API", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("ZIP code", { exact: true })).toBeVisible();
  await context.close();
});
test("homepage search validation, navigation and accessibility", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-quick-form")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Find doctors", exact: true }).click();
  await expect(page.locator("#home-search-error")).toContainText("five-digit");
  await page.getByLabel("ZIP code", { exact: true }).fill("60614");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [], hasMore: false } }));
  await page.getByRole("button", { name: "Find doctors", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?zip=60614/);
  await expect(page.getByRole("heading", { name: "What insurance do you have?" })).toBeVisible();
  await page.getByRole("button", { name: /Skip the insurance check/ }).click();
  await expect(page.getByRole("heading", { name: "What kind of care do you need?" })).toBeVisible();
  await page.getByRole("button", { name: "Show all providers" }).click();
  await expect(page.getByRole("heading", { name: "No providers found" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile menu supports Escape and footer destinations exist", async ({ page, isMobile }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".home-quick-form")).toHaveAttribute("data-ready", "true");
  if (isMobile || (page.viewportSize()?.width ?? 1280) < 768) {
    const button = page.getByRole("button", { name: "Menu", exact: true });
    await button.click();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "About", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
  }
  for (const route of ["/how-it-works", "/data", "/about", "/privacy", "/terms", "/accessibility", "/report"]) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  }
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
test("results, filters, pagination, map and profile actions", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => {
    const skip = new URL(route.request().url()).searchParams.get("skip");
    return route.fulfill({ json: { center: { lat: 41.92, lng: -87.65 }, doctors: skip === "0" ? [doctor] : [{ ...doctor, npi: "1487031407", name: "Second Fixture, MD", specialty: "Internal Medicine" }], hasMore: skip === "0" } });
  });
  await page.route("**/api/doctors/1770664856?**", route => route.fulfill({ json: { doctor } }));
  await page.goto("/results?zip=60614&category=medicare");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Load more doctors" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByLabel("Specialty in these results").selectOption("Internal Medicine");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByLabel("Specialty in these results").selectOption("");
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Map", exact: true }).click();
    await expect(page.locator(".results-map-canvas")).toBeVisible();
    await expect(page.getByRole("region", { name: "Provider results" })).toBeHidden();
    await page.getByRole("button", { name: "List", exact: true }).click();
  } else {
    await expect(page.locator(".results-map-canvas")).toBeVisible();
    await expect(page.getByRole("region", { name: "Provider results" })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Call", exact: true }).first()).toHaveAttribute("href", "tel:3125550100");
  await expect(page.getByRole("link", { name: "Directions", exact: true }).first()).toHaveAttribute("href", /destination=100%20Test/);
  const resultsAxe = await new AxeBuilder({ page }).exclude(".leaflet-container").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(resultsAxe.violations).toEqual([]);
  await page.screenshot({ path: "artifacts/results-" + (page.viewportSize()?.width ?? 1280) + ".png", fullPage: true });
  // Profiles are server-rendered from the live registry, so the fixture NPI
  // can't be opened here; check the link carries the insurance choice.
  await expect(page.getByRole("link", { name: "View profile", exact: true }).first()).toHaveAttribute("href", "/doctor/" + doctor.npi + "?category=medicare");
});
test("directory pages reject unknown cities and specialties", async ({ request }) => {
  expect((await request.get("/find/zz/nowhere")).status()).toBe(404);
  expect((await request.get("/find/il/chicago/not-a-specialty")).status()).toBe(404);
  expect((await request.get("/doctor/123")).status()).toBe(404);
  expect(await (await request.get("/robots.txt")).text()).not.toContain("Disallow: /doctor/");
});
test("errors leave the shell visible and retries recover", async ({ page }) => {
  let fail = true;
  await page.route("**/api/doctors/search?**", route => route.fulfill(fail ? { status: 429, json: { error: "rate_limited" } } : { json: { center: null, doctors: [], hasMore: false } }));
  await page.goto("/results?zip=60614");
  await expect(page.locator(".empty-card[role=alert]")).toContainText("Too many requests");
  await expect(page.getByRole("banner")).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No providers found" })).toBeVisible();
});
test("responsive widths have no horizontal overflow", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const width of [320, 375, 390, 412, 768, 834, 1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
test("loading and offline failures keep navigation available", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => route.abort("internetdisconnected"));
  await page.goto("/results?zip=60614");
  await expect(page.locator(".empty-card[role=alert]")).toContainText("unavailable");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit search", exact: true }).first()).toBeVisible();
});
test("unsupported coverage and unavailable ACA plans are honest", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [{ ...doctor, coverage: { status: "unsupported", label: "This insurance plan is not currently verified by this website.", source: null, checkedAt: "2026-10-05T12:00:00Z" } }], hasMore: false } }));
  await page.goto("/results?zip=60614&category=other");
  await expect(page.getByText("This insurance plan is not currently verified by this website.")).toBeVisible();
  await page.route("**/api/insurance/marketplace/plans?**", route => route.fulfill({ status: 503, json: { error: "not_configured" } }));
  await page.goto("/search");
  await page.getByLabel("Insurance type", { exact: true }).selectOption("marketplace");
  await page.getByLabel("ZIP code", { exact: true }).fill("60614");
  await expect(page.getByText("Insurance verification isn't configured on this site yet.")).toBeVisible();
  await expect(page.getByLabel("Exact Marketplace plan")).toBeDisabled();
});
test("screenshots document representative layouts", async ({ page }, testInfo) => {
  for (const width of [375, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.screenshot({ path: "artifacts/home-" + width + "-" + testInfo.project.name + ".png", fullPage: true });
  }
});
test("invalid API input returns useful status codes", async ({ request }) => {
  expect((await request.get("/api/doctors/search?zip=abc")).status()).toBe(400);
  expect((await request.get("/api/doctors/search?lat=999&lng=100")).status()).toBe(400);
  expect((await request.get("/api/doctors/invalid")).status()).toBe(400);
  expect((await request.post("/api/doctors/geocode", { data: null })).status()).toBe(400);
  expect((await request.post("/api/doctors/geocode", { data: { doctors: [null], center: { lat: 999, lng: 0 } } })).status()).toBe(200);
});

test("InsureBased branding, icons and metadata remain usable at every header width", async ({ page }) => {
  for (const width of [320, 375, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("InsureBased — Find Doctors by Insurance and Location");
    const brand = page.locator(".site-header .site-brand");
    await expect(brand).toHaveText("InsureBased");
    await expect(brand.locator("img")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await brand.evaluate(el => el.getBoundingClientRect().right)).toBeLessThan(width);
    await page.screenshot({ path: "artifacts/insurebased-home-" + width + "-" + test.info().project.name + ".png", fullPage: true });
  }
  for (const asset of ["/favicon.ico", "/apple-touch-icon.png", "/icon-192.png", "/icon-512.png", "/brand/insurebased-mark.svg", "/brand/insurebased-social.png"]) {
    const response = await page.request.get(asset);
    expect(response.status()).toBe(200);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  expect(await page.locator('link[rel="icon"]').first().getAttribute("href")).toContain("favicon.ico");
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "InsureBased");
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("InsureBased");
  await page.goto("/search");
  await expect(page).toHaveTitle("Find Doctors | InsureBased");
});
