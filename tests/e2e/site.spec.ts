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
  // Without JavaScript the search bar is a plain link to the question page.
  await expect(page.getByRole("link", { name: /Search by ZIP code, address, or insurance/ })).toHaveAttribute("href", "/search");
  await context.close();
});
test("search bar opens, validates, closes and searches", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const pill = page.getByRole("link", { name: /Search by ZIP code, address, or insurance/ });
  await pill.click();
  const field = page.getByLabel("ZIP code or street address");
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(pill).toBeFocused();
  await pill.click();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".err-text[role=alert]")).toContainText("Enter a ZIP code or address");
  await field.fill("Chicago IL");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".err-text[role=alert]")).toContainText("street address with city and state");
  await field.fill("60614");
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations).toEqual([]);
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [], hasMore: false } }));
  await page.getByLabel(/Skip for now/).check();
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/results\?zip=60614&category=none/);
  await expect(page.getByRole("heading", { name: "No doctors found here." })).toBeVisible();
  expect(errors).toEqual([]);
});
test("question page asks one skippable question at a time", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [], hasMore: false } }));
  await page.goto("/search?zip=60614&category=medicare", { waitUntil: "networkidle" });
  await expect(page.getByText("Question 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Heart doctor (cardiologist)" }).click();
  await expect(page.getByRole("heading", { name: "How far are you willing to travel?" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "What kind of doctor do you need?" })).toBeVisible();
  await page.getByRole("button", { name: "Heart doctor (cardiologist)" }).click();
  await page.getByRole("button", { name: "Within 5 miles" }).click();
  await expect(page).toHaveURL(/\/results\?zip=60614&category=medicare&specialty=Cardiology&within=5/);
});
test("a chosen ACA plan is carried through every question to results", async ({ page }) => {
  await page.route("**/api/insurance/marketplace/plans?**", route => route.fulfill({ json: { plans: [{ id: "12345IL0010001", name: "Gold PPO", issuerName: "Acme Health", metalLevel: "Gold" }] } }));
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [], hasMore: false } }));
  await page.route("**/api/doctors/coverage?**", route => route.fulfill({ json: { coverage: {} } }));
  await page.goto("/search?zip=60614&category=marketplace", { waitUntil: "networkidle" });
  await page.getByLabel("Plan", { exact: true }).selectOption("12345IL0010001");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Heart doctor (cardiologist)" }).click();
  await page.getByRole("button", { name: "Within 5 miles" }).click();
  await expect(page).toHaveURL(/category=marketplace&planId=12345IL0010001&planName=Gold+PPO/);
});
test("mobile menu supports Escape and footer destinations exist", async ({ page, isMobile }) => {
  await page.goto("/", { waitUntil: "networkidle" });
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
  await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
});
test("results, filters, pagination, map and profile actions", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => {
    const params = new URL(route.request().url()).searchParams;
    const second = { ...doctor, npi: "1487031407", name: "Second Fixture, MD", specialty: "Internal Medicine" };
    if (params.get("specialty")) return route.fulfill({ json: { center: { lat: 41.92, lng: -87.65 }, doctors: [second], hasMore: false } });
    const skip = params.get("skip");
    return route.fulfill({ json: { center: { lat: 41.92, lng: -87.65 }, doctors: skip === "0" ? [doctor] : [second], hasMore: skip === "0" } });
  });
  await page.route("**/api/doctors/1770664856?**", route => route.fulfill({ json: { doctor } }));
  await page.goto("/results?zip=60614&category=medicare");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Load more doctors" }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const filtersButton = page.getByRole("button", { name: /^Filters/ });
  if (await filtersButton.isVisible()) await filtersButton.click();
  await page.getByLabel("Kind of doctor").selectOption("Internal Medicine");
  await expect(page).toHaveURL(/specialty=Internal\+Medicine/);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Second Fixture, MD");
  await page.getByLabel("Kind of doctor").selectOption("");
  await expect(page.getByRole("article")).toHaveCount(1);
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
  await expect(page.getByRole("heading", { name: "No doctors found here." })).toBeVisible();
});
test("responsive widths have no horizontal overflow", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  for (const width of [320, 375, 390, 412, 768, 834, 1024, 1280, 1440, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
test("loading and offline failures keep navigation available", async ({ page, context }) => {
  await page.route("**/api/doctors/search?**", route => route.abort("internetdisconnected"));
  await page.goto("/results?zip=60614");
  await expect(page.locator(".empty-card[role=alert]")).toContainText("Something went wrong on our end");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit search", exact: true }).first()).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".empty-card[role=alert]")).toContainText("You're offline");
  await context.setOffline(false);
});
test("unsupported coverage and unavailable ACA plans are honest", async ({ page }) => {
  await page.route("**/api/doctors/search?**", route => route.fulfill({ json: { center: null, doctors: [{ ...doctor, coverage: { status: "unsupported", label: "This insurance plan is not currently verified by this website.", source: null, checkedAt: "2026-10-05T12:00:00Z" } }], hasMore: false } }));
  await page.goto("/results?zip=60614&category=other");
  await expect(page.getByText("This insurance plan is not currently verified by this website.")).toBeVisible();
  await page.route("**/api/insurance/marketplace/plans?**", route => route.fulfill({ status: 503, json: { error: "not_configured" } }));
  await page.goto("/search?zip=60614&category=marketplace");
  await expect(page.getByText("Plan checks aren't available on this site yet.")).toBeVisible();
  await page.getByRole("button", { name: "Continue without a plan" }).click();
  await page.getByRole("button", { name: "Skip all and show results" }).click();
  await expect(page).toHaveURL(/\/results\?zip=60614&category=none&noPlan=1/);
  await expect(page.getByText("coverage not checked (no plan chosen)")).toBeVisible();
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
  expect((await request.post("/api/location", { data: { q: "" } })).status()).toBe(400);
  expect((await request.post("/api/location", { data: { q: "Chicago IL" } })).status()).toBe(400);
  expect(await (await request.post("/api/location", { data: { q: "60614" } })).json()).toEqual({ zip: "60614" });
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
