import { getOctokit, context } from '@actions/github';
import * as core from '@actions/core';
import process from 'process';


try {

  const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
  if (!token) {
    throw new Error('No GitHub token provided.');
  }

  const octokit = getOctokit(token);
  const { owner, repo, number } = context.issue

  const { TOTAL, PASSED, FAILED, FLAKY, SKIPPED, REPORT_FOLDER } = process.env;

  const commentTitle = `# Playwright Test Results ${FAILED > 0 ? '❌' : '✅'}`;
  const commentBody = `
  ${commentTitle}
  ## Summary
  - **Total**: ${TOTAL}
  - **Passed**: ${PASSED}
  - **Failed**: ${FAILED}
  - **Flaky**: ${FLAKY}
  - **Skipped**: ${SKIPPED}
  ## Details
  [Report Link](${`https://${owner}.github.io/${repo}/${REPORT_FOLDER}`})
  [ALL tests Link](${`https://${owner}.github.io/${repo}}/`})
  ## Additional Information
  Last updated: ${new Date().toUTCString()}
  `;

   // Get all comments for this PR/issue
   const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: number,
  });

  // Look for an existing comment that starts with the same title
  const existingComment = comments.find(comment => 
    comment.body.trim().startsWith(commentTitle.trim())
  )

  if(existingComment) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body: commentBody,
    });
    console.log('Comment updated successfully');
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: number,
      body: commentBody,
      headers: {
        authorization: `token ${token}`,
      },
    });
    console.log('Comment created successfully');
  }
} catch (error) {
  console.error('Error creating comment:', error);
}
