import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { setOutput, info, error, setFailed } from '@actions/core';
import process from 'process';

const workspaceDir = process.env.GITHUB_WORKSPACE || '.';
// The path to the Playwright test results file is configured in the Playwright config file.
const reportFilePath = join(workspaceDir, 'playwright-report', 'results.json');

let total = 0;
let passed = 0;
let failed = 0;
let flaky = 0;
let skipped = 0;

try {
  info(`Reading test results from ${reportFilePath}`);

  if (!existsSync(reportFilePath)) throw new Error(`Test results file not found: ${reportFilePath}`);

  const reportFile = readFileSync(reportFilePath, 'utf8');
  const report = JSON.parse(reportFile);
  const { stats } = report;
  if (!stats) throw new Error('No suites found in test results');

  failed = stats.unexpected ?? 0;
  flaky = stats.flaky ?? 0;
  skipped = stats.skipped ?? 0;
  total = failed + flaky + skipped;
  passed = total - failed - flaky;

  info(`Parsing successful: Passed=${passed}, Failed=${failed}, Flaky=${flaky}, Skipped=${skipped}`);

} catch (err) {
  error(`An error occurred processing the report: ${err.message}`);
  setFailed(`Script failed: ${err.message}`);
}

setOutput('total', total);
setOutput('passed', passed);
setOutput('failed', failed);
setOutput('flaky', flaky);
setOutput('skipped', skipped);

info(`Outputs set: passed=${passed}, failed=${failed}, flaky=${flaky}, skipped=${skipped}`);
