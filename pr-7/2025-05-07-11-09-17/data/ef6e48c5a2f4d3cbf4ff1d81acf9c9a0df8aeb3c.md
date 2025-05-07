# Test info

- Name: has title
- Location: /home/runner/work/playwright-tests/playwright-tests/tests/app.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

    at /home/runner/work/playwright-tests/playwright-tests/tests/app.spec.ts:4:14
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test('has title', async ({ page }) => {
>  4 |   await page.goto('/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5173/
   5 |
   6 |   // Expect a title "to contain" a substring.
   7 |   await expect(page).toHaveTitle(/Vite + React Hello/);
   8 | });
   9 |
  10 | test('should fails', async ({ page }) => {
  11 |   await page.goto('/');
  12 |
  13 |   // Expect a title "to contain" a substring.
  14 |   await expect(page).toHaveTitle(/ok/);
  15 | });
  16 |
```

# Local changes

```diff
diff --git a/.github/workflows/playwright.yml b/.github/workflows/playwright.yml
index 64184ac..a67bd31 100644
--- a/.github/workflows/playwright.yml
+++ b/.github/workflows/playwright.yml
@@ -31,11 +31,6 @@ jobs:
     name: Run Tests
     needs: wait-for-deployment-url
     runs-on: ubuntu-latest
-    # outputs:
-    #   passed: ${{ steps.extract-test-results.outputs.passed }}
-    #   failed: ${{ steps.extract-test-results.outputs.failed }}
-    #   flaky: ${{ steps.extract-test-results.outputs.flaky }}
-    #   skipped: ${{ steps.extract-test-results.outputs.skipped }}
     env:
       BASE_URL: ${{ needs.wait-for-deployment-url.outputs.deployment_url }}
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
diff --git a/tests/app.spec.ts b/tests/app.spec.ts
new file mode 100644
index 0000000..92dda29
--- /dev/null
+++ b/tests/app.spec.ts
@@ -0,0 +1,15 @@
+import { test, expect } from '@playwright/test';
+
+test('has title', async ({ page }) => {
+  await page.goto('/');
+
+  // Expect a title "to contain" a substring.
+  await expect(page).toHaveTitle(/Vite + React Hello/);
+});
+
+test('should fails', async ({ page }) => {
+  await page.goto('/');
+
+  // Expect a title "to contain" a substring.
+  await expect(page).toHaveTitle(/ok/);
+});
```