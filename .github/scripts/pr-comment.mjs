import github from '@actions/github';
import process from 'process';

const { GITHUB_TOKEN } = process.env;

const { owner, repo, number } = github.context.issue

try {
  const commentBody = `Hey`;
  await github.getOctokit(GITHUB_TOKEN).rest.issues.createComment({
    owner,
    repo,
    issue_number: number,
    body: commentBody,
    headers: {
      authorization: `token ${GITHUB_TOKEN}`,
    },
  });
  console.log('Comment created successfully');
} catch (error) {
  console.error('Error creating comment:', error);
}
