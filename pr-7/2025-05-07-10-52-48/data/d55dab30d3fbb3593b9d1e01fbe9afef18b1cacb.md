# Test info

- Name: Should fail
- Location: /home/runner/work/playwright-tests/playwright-tests/tests/example.spec.ts:20:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
    at /home/runner/work/playwright-tests/playwright-tests/tests/example.spec.ts:21:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test('has title', async ({ page }) => {
   4 |   await page.goto('https://playwright.dev/');
   5 |
   6 |   // Expect a title "to contain" a substring.
   7 |   await expect(page).toHaveTitle(/Playwright/);
   8 | });
   9 |
  10 | test('get started link', async ({ page }) => {
  11 |   await page.goto('https://playwright.dev/');
  12 |
  13 |   // Click the get started link.
  14 |   await page.getByRole('link', { name: 'Get started' }).click();
  15 |
  16 |   // Expects page to have a heading with the name of Installation.
  17 |   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  18 | });
  19 |
  20 | test('Should fail', async ({}) => {
> 21 |   expect(true).toBe(false);
     |                ^ Error: expect(received).toBe(expected) // Object.is equality
  22 | })
  23 |
```

# Local changes

```diff
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