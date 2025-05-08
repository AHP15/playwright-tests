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
      await exec.exec("git", ["init", tempDir]);
      process.chdir(tempDir);
      await exec.exec("git", ["checkout", "--orphan", "gh-pages"]);
      await exec.exec("git", ["remote", "add", "origin", repoURL]);
      process.chdir("..");
    }
  );

  process.chdir(tempDir);

  // If the branch exists and has files, remove all files except .git
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

  // Add a .nojekyll file to bypass Jekyll processing
  fs.writeFileSync(".nojekyll", "");

  // Add, commit, and push changes
  console.log("Committing empty gh-pages branch...");
  await exec("git", ["add", "-A"]);
  await exec("git", ["commit", "-m", "Clear gh-pages branch", "--allow-empty"]);

  console.log("Pushing changes...");
  await exec("git", ["push", "-f", "origin", "gh-pages"]);

  console.log("Successfully cleared gh-pages branch");

  console.log("Updating comments in open PRs/issues...");

  // Get issues and PRs separately to ensure we process both
  const allOpenIssues = await octokit.paginate(
    octokit.rest.issues.listForRepo,
    {
      owner,
      repo,
      state: "open",
      per_page: 100,
      filter: "all"  // Explicitly request all issues
    }
  );

  console.log(
    `Found ${allOpenIssues.length} open issues/PRs to check for Playwright comments`
  );

  const commentTitle = "# Playwright Test Results";
  let updatedCommentCount = 0;

  for (const issue of allOpenIssues) {
    console.log(`Processing ${issue.pull_request ? "PR" : "Issue"} #${issue.number}`);

    // Get all comments for the issue/PR
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issue.number,
      per_page: 100,
    });

    // More flexible matching to catch variations in comment formatting
    const matchingComments = comments.filter((comment) => 
      comment.body && (
        comment.body.trim().startsWith(commentTitle.trim()) || 
        comment.body.includes(commentTitle.trim())
      )
    );

    if (matchingComments.length > 0) {
      console.log(
        `Found ${matchingComments.length} Playwright test comments in ${issue.pull_request ? "PR" : "Issue"} #${issue.number}`
      );
    }

    for (const comment of matchingComments) {
      // Update the comment title
      let newBody = comment.body;
      if (newBody.includes(commentTitle)) {
        newBody = newBody.replace(
          commentTitle,
          `# Playwright Test Results [DELETED]`
        );
      }

      // Add a notice about reports being deleted
      const deletedNotice = `\n\n**NOTICE: All reports have been deleted from the gh-pages branch.**\nDeleted on: ${new Date().toUTCString()}, to see the reports please re-run the test action.`;

      // Make sure we don't duplicate the notice if updating multiple times
      if (!newBody.includes("**NOTICE: All reports have been deleted")) {
        newBody += deletedNotice;
      }

      // Update the comment
      try {
        await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: comment.id,
          body: newBody,
        });

        updatedCommentCount++;
        console.log(
          `Updated comment ${comment.id} in ${issue.pull_request ? "PR" : "Issue"} #${issue.number} to indicate deletion`
        );
      } catch (error) {
        console.error(`Failed to update comment ${comment.id}: ${error.message}`);
      }
    }
  }

  console.log(
    `Updated ${updatedCommentCount} comments in total across all open issues/PRs`
  );
} catch (error) {
  core.setFailed(`Action failed with error ${error}`);
}
