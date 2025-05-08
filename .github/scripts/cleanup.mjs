import { getOctokit, context } from "@actions/github";
import * as core from "@actions/core";
import process from "process";
import { exec } from "@actions/exec";
import * as fs from "fs";
import * as path from "path";

try {
  const token = process.env.GITHUB_TOKEN || core.getInput("github-token");
  if (!token) {
    throw new Error("No GitHub token provided.");
  }

  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  await exec("git", ["config", "--global", "user.name", "github-actions"]);
  await exec("git", [
    "config",
    "--global",
    "user.email",
    "github-actions@github.com",
  ]);

  const tempDir = path.join(process.cwd(), "gh-pages-temp");
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir);

  const repoURL = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
  console.log("Checking out gh-pages branch...");
  await exec("git", ["clone", repoURL, tempDir, "--branch", "gh-pages"]).catch(
    async (error) => {
      console.log("gh-pages branch does not exist yet, creating it...");
      // Corrected exec calls: directly use exec()
      await exec("git", ["init", tempDir]);
      process.chdir(tempDir);
      await exec("git", ["checkout", "--orphan", "gh-pages"]);
      await exec("git", ["remote", "add", "origin", repoURL]);
      process.chdir("..");
    }
  );

  process.chdir(tempDir);

  const files = fs.readdirSync(".");
  for (const file of files) {
    if (file !== ".git") {
      const filePath = path.join(".", file);
      if (fs.lstatSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }
  }

  fs.writeFileSync(".nojekyll", "");

  console.log("Committing empty gh-pages branch...");
  await exec("git", ["add", "-A"]);
  await exec("git", ["commit", "-m", "Clear gh-pages branch", "--allow-empty"]);

  console.log("Pushing changes...");
  await exec("git", ["push", "-f", "origin", "gh-pages"]);

  console.log("Successfully cleared gh-pages branch");

  console.log("Updating comments and issue bodies in open PRs/issues...");

  const allOpenIssues = await octokit.paginate(
    octokit.rest.issues.listForRepo,
    {
      owner,
      repo,
      state: "open",
      per_page: 100,
    }
  );

  console.log(
    `Found ${allOpenIssues.length} open issues/PRs to check for Playwright content.`
  );

  const commentTitle = "# Playwright Test Results";
  const targetTitleString = commentTitle.trim();
  const replacementTitleString = `${targetTitleString} [DELETED]`;
  const deletedNotice = `\n\n**NOTICE: All reports have been deleted from the gh-pages branch.**\nDeleted on: ${new Date().toUTCString()}, to see the reports please re-run the test action.`;

  let updatedCommentCount = 0;
  let updatedIssueBodyCount = 0;

  for (const issue of allOpenIssues) {
    const issueNumber = issue.number;
    const isPullRequest = !!issue.pull_request; // True if it's a PR, false if it's an issue

    if (!isPullRequest) { // It's a regular issue
      if (issue.body && issue.body.includes(targetTitleString)) {
        console.log(`Found '${targetTitleString}' in the body of issue #${issueNumber}.`);
        const newIssueBody = issue.body.replace(targetTitleString, replacementTitleString);
        try {
          await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: issueNumber,
            body: newIssueBody + deletedNotice,
          });
          console.log(`Updated body of issue #${issueNumber}.`);
          updatedIssueBodyCount++;
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error(`Failed to update body of issue #${issueNumber}: ${errorMessage}`);
          core.warning(`Failed to update body of issue #${issueNumber}: ${errorMessage}`);
        }
      }
    }

    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const matchingComments = comments.filter(
      (comment) => comment.body && comment.body.trim().startsWith(targetTitleString)
    );

    if (matchingComments.length > 0) {
      const itemType = isPullRequest ? "PR" : "issue";
      console.log(
        `Found ${matchingComments.length} Playwright test comments in open ${itemType} #${issueNumber}`
      );
    }

    for (const comment of matchingComments) {
      const newCommentBody = comment.body.replace(targetTitleString, replacementTitleString);
      try {
        await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: comment.id,
          body: newCommentBody + deletedNotice,
        });
        updatedCommentCount++;
        const itemType = isPullRequest ? "PR" : "issue";
        console.log(
          `Updated comment ${comment.id} in open ${itemType} #${issueNumber} to indicate deletion`
        );
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Failed to update comment ${comment.id} in issue/PR #${issueNumber}: ${errorMessage}`);
        core.warning(`Failed to update comment ${comment.id} in issue/PR #${issueNumber}: ${errorMessage}`);
      }
    }
  }

  console.log(
    `Updated ${updatedIssueBodyCount} issue bodies in total across all open issues.`
  );
  console.log(
    `Updated ${updatedCommentCount} comments in total across all open issues/PRs.`
  );

} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  core.setFailed(`Action failed with error ${errorMessage}`);
}
