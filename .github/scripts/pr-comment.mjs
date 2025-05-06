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

  const commentBody = `Hey`;

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
} catch (error) {
  console.error('Error creating comment:', error);
}
