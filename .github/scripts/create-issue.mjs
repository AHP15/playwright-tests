import * as core from '@actions/core';
import { getOctokit, context } from '@actions/github';

try {
  const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
  if (!token) {
    throw new Error('No GitHub token provided.');
  }

  const { TOTAL, PASSED, FAILED, FLAKY, SKIPPED, REPORT_FOLDER } = process.env;

  const octokit = getOctokit(token);
  const { owner, repo } = context.issue

  const issueTitle = `# Playwright Test Results ❌`;
  const issueBody = `
  ${issueTitle}
  ## Summary
  - **Total**: ${TOTAL}
  - **Passed**: ${PASSED}
  - **Failed**: ${FAILED}
  - **Flaky**: ${FLAKY}
  - **Skipped**: ${SKIPPED}
  ## Details
  [Report Link](${`https://${owner}.github.io/${repo}/${REPORT_FOLDER}`})

  [ALL Reports Link](${`https://${owner}.github.io/${repo}`})
  ## Additional Information
  Last updated: ${new Date().toUTCString()}
  `;

  await octokit.rest.issues.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: issueTitle,
    body: issueBody,
  });
  console.log('Issue created successfully');

} catch (error) {
  console.error('Error creating issue:', error);
}
