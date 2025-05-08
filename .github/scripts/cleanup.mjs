import { getOctokit, context } from '@actions/github';
import * as core from '@actions/core';
import process from 'process';
import { exec } from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import process from 'process';

try {
  const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
    if (!token) {
      throw new Error('No GitHub token provided.');
    }

    const octokit = getOctokit(token);
    const { owner, repo } = context.repo;

    await exec('git', ['config', '--global', 'user.name', 'github-actions']);
    await exec('git', ['config', '--global', 'user.email', 'github-actions@github.com']);

    const tempDir = path.join(process.cwd(), 'gh-pages-temp');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);

    const repoURL = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    console.log('Checking out gh-pages branch...');
    await exec(
      'git',
      ['clone', repoURL, tempDir, '--branch', 'gh-pages']
    ).catch(async (error) => {
      console.log('gh-pages branch does not exist yet, creating it...');
      await exec.exec('git', ['init', tempDir]);
      process.chdir(tempDir);
      await exec.exec('git', ['checkout', '--orphan', 'gh-pages']);
      await exec.exec('git', ['remote', 'add', 'origin', repoURL]);
      process.chdir('..');
    });

    process.chdir(tempDir);

    // If the branch exists and has files, remove all files except .git
    const files = fs.readdirSync('.');
    for (const file of files) {
      if (file !== '.git') {
        const filePath = path.join('.', file);
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }
    
    // Add a .nojekyll file to bypass Jekyll processing
    fs.writeFileSync('.nojekyll', '');

    // Add, commit, and push changes
    console.log('Committing empty gh-pages branch...');
    await exec.exec('git', ['add', '-A']);
    await exec.exec('git', ['commit', '-m', 'Clear gh-pages branch', '--allow-empty']);
    
    console.log('Pushing changes...');
    await exec.exec('git', ['push', '-f', 'origin', 'gh-pages']);
    
    console.log('Successfully cleared gh-pages branch');

    // update PR comments to indacate that the gh-pages branch has been cleared
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: number,
    });

    const commentTitle = '# Playwright Test Results'
    const existingComments = comments.filter(comment => 
      comment.body.trim().startsWith(commentTitle.trim())
    );

    // Update each existing comment to include 'DELETED'
    for (const comment of existingComments) {
      // Create the new comment body with DELETED marker
      const newBody = comment.body.replace(
        commentTitle,
        `# Playwright Test Results [DELETED]`
      );
    
      // Add a notice about reports being deleted
      const deletedNotice = `\n\n**NOTICE: All reports have been deleted from the gh-pages branch.**\nDeleted on: ${new Date().toUTCString()}, to see the reports please re-run the test action.`;
    
      // Update the comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: comment.id,
        body: newBody + deletedNotice,
      });
    
      console.log(`Updated comment ${comment.id} to indicate deletion`);
    }

} catch (error) {
  core.setFailed(`Action failed with error ${error}`);
}