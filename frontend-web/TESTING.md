# E2E Testing Guide — MySmartStudy

This project uses **Playwright** with **ZeroStep AI** for end-to-end testing. ZeroStep's `ai()` function lets you write browser interactions in plain English instead of fragile CSS selectors.

---

## Prerequisites

1. **Node dependencies installed**

   ```bash
   cd frontend-web
   npm install
   ```

2. **Playwright browsers installed**

   ```bash
   npx playwright install chromium
   ```

3. **Both servers running** (in separate terminals)

   ```bash
   # Terminal 1 — Backend
   cd backend
   uvicorn main:app --reload
   # Runs on http://localhost:8000

   # Terminal 2 — Frontend
   cd frontend-web
   npm run dev
   # Runs on http://localhost:3000
   ```

4. **Environment variables**

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `ZEROSTEP_TOKEN` | Yes | Your ZeroStep API token |
   | `TEST_STUDENT_EMAIL` | No | Test student email (default: `student@test.com`) |
   | `TEST_STUDENT_PASSWORD` | No | Test student password (default: `password123`) |

---

## Running Tests

### Run Login Page UI test only (no credentials needed)

```bash
cd frontend-web
ZEROSTEP_TOKEN=<your-token> npx playwright test -g "Login Page UI"
```

### Run the full login → dashboard journey (requires credentials)

```bash
TEST_STUDENT_EMAIL=ali@moe-dl.edu.my \
TEST_STUDENT_PASSWORD=mypassword \
ZEROSTEP_TOKEN=<your-token> \
npx playwright test
```

If `TEST_STUDENT_EMAIL` or `TEST_STUDENT_PASSWORD` are not set, the dashboard journey test is automatically **skipped** (not failed).

### Watch the browser (headed mode)

```bash
ZEROSTEP_TOKEN=<your-token> npx playwright test --headed
```

### Using the npm script

```bash
ZEROSTEP_TOKEN=<your-token> npm run test:e2e
```

---

## Viewing Results

### HTML Report

After a test run, Playwright generates an HTML report automatically.

```bash
npx playwright show-report
```

This opens a browser with:
- Pass/fail status for each test step
- Screenshots captured on failure
- Trace files for step-by-step debugging

### Trace Viewer (on failure)

When a test fails, Playwright saves a trace file. Open it with:

```bash
npx playwright show-trace test-results/<test-folder>/trace.zip
```

The trace viewer shows:
- A timeline of every action
- DOM snapshots at each step
- Network requests
- Console logs

---

## Test Structure

```
frontend-web/
  playwright.config.ts     ← Playwright configuration
  tests/
    dashboard-ai.spec.ts   ← Student login → dashboard journey
```

### What the tests cover

**Test 1: Login Page UI** (no credentials needed)
- Verifies "Welcome Back" heading, email input, password input, Sign In button, Google sign-in button, Forgot Password link, and Register link.

**Test 2: Student Login → Dashboard Journey** (requires `TEST_STUDENT_EMAIL` + `TEST_STUDENT_PASSWORD`)

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Navigate to `/login` | Login form visible |
| 2 | Enter credentials | Fields populated |
| 3 | Click Sign In | Redirects to `/student/dashboard` |
| 4 | Dashboard loads | Welcome banner, Recent Maps, stat cards, sidebar |
| 5 | Click "My Maps" in sidebar | Navigates to `/student/my-maps` |
| 6 | Click "Dashboard" in sidebar | Returns to `/student/dashboard` |
| 7 | Open profile dropdown | Dropdown with Profile and Sign Out options |
| 8 | Click Sign Out | Redirects to login/landing page |

---

## Adding New Tests

Create a new `.spec.ts` file in `tests/`. Use the `ai()` function for interactions:

```ts
import { test } from "@playwright/test";
import { ai } from "@zerostep/playwright";

test("example", async ({ page }) => {
  await page.goto("/some-page");

  // Use natural language for actions
  await ai("Click the Submit button", { page, test });

  // Use natural language for assertions
  await ai("Verify that a success message is displayed", { page, test });
});
```

### Tips

- `ai()` calls the ZeroStep API, so each call adds latency (~2-5s). Use standard Playwright selectors for simple, stable elements.
- Use `page.waitForURL()` between navigations for reliability.
- Set `headless: false` in `playwright.config.ts` during development to see what's happening.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ZEROSTEP_TOKEN` not set | Export it: `export ZEROSTEP_TOKEN=your-token` |
| Browser not installed | Run `npx playwright install chromium` |
| Test times out on login | Check both servers are running; verify credentials |
| `ai()` calls failing | Check your ZeroStep token is valid and has quota |
| Port 3000/8000 in use | Kill existing processes or change ports |
