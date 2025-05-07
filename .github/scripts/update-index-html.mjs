import * as core from '@actions/core';
import { getOctokit, context } from '@actions/github';

const intialeIndexContent = (newEntry) => `
<!DOCTYPE html>
<html>
<head>
  <title>Playwright Test Reports</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    ul { list-style-type: none; padding: 0; }
    li { margin: 10px 0; padding: 10px; border-bottom: 1px solid #eee; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Playwright Test Reports</h1>
  <ul>
    ${newEntry}
  </ul>
</body>
</html>
`;

try {
  const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
  const reportFolder = process.env.REPORT_FOLDER;
  const passed = process.env.PASSED || '0';
  const failed = process.env.FAILED || '0';
  const flaky = process.env.FLAKY || '0';
  const skipped = process.env.SKIPPED || '0';

  if (!token) {
    throw new Error('No GitHub token provided.');
  }

  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  core.info(`Updating index.html on gh-pages for ${owner}/${repo}`);

  const reportTitle = `Test Report ${reportFolder}`;

  const newEntry = `<li><a href="${reportFolder}/index.html">${reportTitle}</a> - Passed: ${passed}, Failed: ${failed}, Flaky: ${flaky}, Skipped: ${skipped}</li>`;
    
  let indexContent;
  let sha;

  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'index.html',
      ref: 'gh-pages'
    });
    
    sha = fileData.sha;
    
    // Decode content from base64
    const content = Buffer.from(fileData.content, 'base64').toString();
    
    // Insert new entry after the <ul> tag
    indexContent = content.replace('<ul>', `<ul>\n      ${newEntry}`);
    
    core.info('Existing index.html found, updating with new entry');
  } catch(err) {
    if(err.status === 404) {
      indexContent = intialeIndexContent(indexContent);
      core.info('No existing index.html found, creating a new one');
    } else {
      core.error('Error fetching index.html:', err);
      throw err;
    }
  }

  // Update or create index.html file
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'index.html',
    message: `Update index.html with link to new test report: ${reportFolder}`,
    content: Buffer.from(indexContent).toString('base64'),
    branch: 'gh-pages',
    ...(sha && { sha })
  });
  
  core.info('Successfully updated index.html on gh-pages branch');


} catch (error) {
  core.setFailed(`Error updating index.html: ${error.message}`);
  if (error.stack) core.debug(error.stack);
}
