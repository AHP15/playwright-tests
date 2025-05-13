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

  // Get all comments for this PR/issue
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: number,
  });

  // Look for an existing comment that starts with the same title
  const vercelComment = comments.find(comment => 
    comment.user.login === 'vercel[bot]'
  );

  if(vercelComment) {
    while (true) {
      const {data: comment} = await octokit.rest.issues.getComment({
        owner,
        repo,
        issue_number: number,
        comment_id: vercelComment.id,
      });

      if(comment.body.includes('✅ Ready')) {
        console.log('Deployment is ready!');
        break;
      }
    }
  } else {
    console.log('No Vercel comment found');
  }


} catch (error) {
  core.setFailed(`Error: ${error.message}`);
  process.exit(1);
}
