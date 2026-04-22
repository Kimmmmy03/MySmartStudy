/**
 * ============================================================
 *  TEST PLAN — Student Login → Dashboard E2E Journey
 * ============================================================
 *
 * This test validates the core student user journey using
 * ZeroStep's ai() function for natural-language browser
 * interactions against the MySmartStudy LMS.
 *
 * Pre-conditions:
 *   - Frontend dev server running at http://localhost:3000
 *   - Backend dev server running at http://localhost:8000
 *   - A test student account exists (set TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD env vars)
 *   - ZEROSTEP_TOKEN env var is set
 *
 * Journey Steps:
 *   1. Navigate to /login page
 *   2. Verify the login form is visible (Email, Password fields, Sign In button)
 *   3. Enter student credentials into the login form
 *   4. Click "Sign In" and wait for redirect to /student/dashboard
 *   5. Verify the student dashboard loaded:
 *      a. Welcome banner with student's name is visible
 *      b. "Recent Maps" section is present
 *      c. Stats cards (Courses Enrolled, Activities Done, etc.) are visible
 *      d. Sidebar navigation links are visible (Dashboard, My Maps, Courses)
 *   6. Navigate to "My Maps" via sidebar
 *   7. Verify the My Maps page loaded
 *   8. Navigate back to Dashboard
 *   9. Open the user profile dropdown in the navbar
 *  10. Sign out and verify redirect to login/landing page
 *
 * ============================================================
 */

import { test, expect, Page } from "@playwright/test";
import { ai } from "@zerostep/playwright";

// ── Test credentials ──
// Override via environment variables for CI; defaults to seeded test account.
const TEST_EMAIL = process.env.TEST_STUDENT_EMAIL || "student1@mysmartstudy.com";
const TEST_PASSWORD = process.env.TEST_STUDENT_PASSWORD || "Test1234!";

/**
 * Dismiss any badge celebration modals that appear after page navigation.
 * The dashboard layout triggers badge checks on every route change,
 * which can pop up a full-screen overlay with "Next Badge" / "Awesome!" buttons.
 */
async function dismissBadgeModals(page: Page) {
  // Wait a moment for badge check API calls to complete and modal to appear
  await page.waitForTimeout(2_000);

  for (let i = 0; i < 10; i++) {
    // Check if "BADGE UNLOCKED" text is visible anywhere on the page
    const badgeText = page.getByText("BADGE UNLOCKED");
    if (!await badgeText.isVisible({ timeout: 1_000 }).catch(() => false)) break;

    // Try clicking "Next Badge" or "Awesome!" button
    const nextBtn = page.getByRole("button", { name: "Next Badge" });
    const awesomeBtn = page.getByRole("button", { name: "Awesome!" });

    if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await nextBtn.click();
    } else if (await awesomeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await awesomeBtn.click();
    } else {
      // Fallback: press Escape or click at the edge of the viewport
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(700);
  }
}

// ────────────────────────────────────────────────────────
//  Test 1: Login page UI (no credentials needed)
// ────────────────────────────────────────────────────────
test.describe("Login Page UI", () => {
  test("should display the login form correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });

    // Verify all login form elements are present
    await ai("Verify that the page shows a 'Welcome Back' heading", { page, test });
    await ai("Verify that there is an email input field with placeholder text", { page, test });
    await ai("Verify that there is a password input field", { page, test });
    await ai("Verify that there is a 'Sign In' button", { page, test });
    await ai("Verify that there is a 'Sign in with Google' button", { page, test });
    await ai("Verify that there is a 'Forgot Password?' link", { page, test });
    await ai("Verify that there is a 'Register' link for new accounts", { page, test });
  });
});

// ────────────────────────────────────────────────────────
//  Test 2: Full login → dashboard journey (requires creds)
// ────────────────────────────────────────────────────────
test.describe("Student Login → Dashboard Journey", () => {
  // Increase timeout — ZeroStep AI calls add ~3-5s each
  test.setTimeout(180_000);

  // Skip if no credentials are provided
  test.skip(!TEST_EMAIL || !TEST_PASSWORD,
    "Skipped: set TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD env vars to run this test"
  );

  test("should login as student and interact with the dashboard", async ({ page }) => {
    // ── Step 1: Navigate to login page ──
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });

    // ── Step 2: Verify login form is visible ──
    await ai("Verify that the login page is displayed with an email input field, a password input field, and a Sign In button", { page, test });

    // ── Step 3: Enter credentials (using Playwright directly for reliability) ──
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);

    // ── Step 4: Submit login and wait for dashboard ──
    await page.locator('button[type="submit"]').click();

    // Wait for redirect — either to student or lecturer dashboard
    await page.waitForURL((url) => url.pathname.includes("/dashboard"), {
      timeout: 30_000,
    });

    // Verify no error message appeared (successful login)
    const errorVisible = await page.locator("text=Invalid email or password").isVisible().catch(() => false);
    expect(errorVisible, "Login failed — check TEST_STUDENT_EMAIL and TEST_STUDENT_PASSWORD").toBeFalsy();

    // Dismiss any badge celebration modals
    await dismissBadgeModals(page);

    // ── Step 5a: Verify welcome banner ──
    await ai("Verify that a welcome banner is visible that says 'Welcome back' or greets the user by name", { page, test });

    // ── Step 5b: Verify Recent Maps section ──
    await ai("Verify that a 'Recent Maps' section heading is visible on the page", { page, test });

    // ── Step 5c: Verify stats cards ──
    await ai("Verify that stat cards are visible showing 'Courses Enrolled', 'Activities Done', 'Activities Due', and 'Total Maps'", { page, test });

    // ── Step 5d: Verify sidebar navigation ──
    await ai("Verify that a sidebar or navigation menu is visible with links including 'Dashboard', 'My Maps', and 'Courses'", { page, test });

    // ── Step 6: Navigate to My Maps page via sidebar ──
    await ai("Click on the 'My Maps' link in the sidebar navigation", { page, test });
    await page.waitForURL("**/student/my-maps", { timeout: 15_000 });

    // Dismiss any badge modals that appear after navigation
    await dismissBadgeModals(page);

    // ── Step 7: Verify My Maps page loaded ──
    await ai("Verify that the My Maps page is displayed", { page, test });

    // Dismiss any late-arriving badge modals before interacting with sidebar
    await dismissBadgeModals(page);

    // ── Step 8: Navigate back to Dashboard ──
    // Use direct Playwright click on sidebar link for reliability
    await page.locator('a[href="/student/dashboard"]').first().click();
    await page.waitForURL("**/student/dashboard", { timeout: 15_000 });

    // Dismiss any badge modals that appear after navigation
    await dismissBadgeModals(page);

    // ── Step 9: Open profile dropdown ──
    await ai("Click on the user profile avatar or dropdown button in the top navigation bar", { page, test });
    await ai("Verify that a dropdown menu appears with options including 'Profile' and either 'Sign Out' or 'Log Out'", { page, test });

    // ── Step 10: Sign out ──
    await ai("Click the 'Sign Out' or 'Log Out' option in the dropdown menu", { page, test });

    // Should redirect away from dashboard
    await page.waitForURL((url) => !url.pathname.includes("/student/dashboard"), {
      timeout: 15_000,
    });
    await ai("Verify that the user has been signed out and is on the login page or landing page", { page, test });
  });
});
