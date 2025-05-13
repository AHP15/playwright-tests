import { getOctokit, context } from '@actions/github';
import * as core from '@actions/core';
import fetch from 'node-fetch';
import process from "process";

/**
 * Wait for the specified amount of time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Main function to check Vercel deployment status using Vercel API
 */
async function main() {
  try {
    // Required inputs
    const vercelToken = process.env.VERCEL_TOKEN || core.getInput('vercel-token', { required: true });
    const vercelTeamId = process.env.VERCEL_TEAM_ID || core.getInput('vercel-team-id');
    const vercelProjectId = process.env.VERCEL_PROJECT_ID || core.getInput('vercel-project-id', { required: true });
    
    // GitHub context
    const githubToken = process.env.GITHUB_TOKEN || core.getInput('github-token');
    const octokit = githubToken ? getOctokit(githubToken) : null;
    const { owner, repo } = context.repo;
    
    // Determine if we're in a PR or push context
    const isPR = !!context.payload.pull_request;
    const prNumber = isPR ? context.payload.pull_request.number : null;
    
    // Get branch info - handles both PR and push events
    let gitBranch;
    let commitSha;
    
    if (isPR) {
      // PR context
      gitBranch = context.payload.pull_request.head.ref;
      commitSha = context.payload.pull_request.head.sha;
      console.log(`Running in PR context: PR #${prNumber}, branch ${gitBranch}, commit ${commitSha}`);
    } else {
      // Push/merge context
      // For push events, the ref is in format "refs/heads/main"
      gitBranch = process.env.GITHUB_REF_NAME || 
                context.payload.ref?.replace('refs/heads/', '') || 
                'main'; // Default to main if we can't determine
      commitSha = context.sha;
      console.log(`Running in push/merge context: branch ${gitBranch}, commit ${commitSha}`);
    }
    
    // Config
    const maxRetries = parseInt(process.env.MAX_RETRIES || core.getInput('max-retries') || '30');
    const retryInterval = parseInt(process.env.RETRY_INTERVAL_SECONDS || core.getInput('retry-interval-seconds') || '10') * 1000;
    
    console.log(`Looking for Vercel deployment for project ID ${vercelProjectId}...`);
    
    // Build Vercel API base URL
    const vercelApiBaseUrl = 'https://api.vercel.com';
    
    // API request parameters
    const requestParams = new URLSearchParams({
      projectId: vercelProjectId,
      limit: '10', // Increased limit to better chance of finding the right deployment
      target: isPR ? 'preview' : 'production' // Use preview for PRs, production for main branch
    });
    
    // Add team ID if provided
    if (vercelTeamId) {
      requestParams.append('teamId', vercelTeamId);
    }
    
    // API headers
    const headers = {
      'Authorization': `Bearer ${vercelToken}`,
      'Content-Type': 'application/json'
    };
    
    let deployment = null;
    
    // Poll for the deployment
    for (let i = 0; i < maxRetries; i++) {
      console.log(`Attempt ${i+1}/${maxRetries} to find deployment...`);
      
      try {
        // Fetch recent deployments
        const response = await fetch(`${vercelApiBaseUrl}/v6/deployments?${requestParams}`, {
          headers
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get deployments: ${response.status} ${response.statusText}`);
        }
        
        const { deployments } = await response.json();
        
        if (!deployments || deployments.length === 0) {
          console.log('No deployments found for this project');
          if (i < maxRetries - 1) {
            await sleep(retryInterval);
            continue;
          }
          throw new Error('No deployments found');
        }
        
        // Find deployment matching our branch or commit
        deployment = deployments.find(d => {
          // Check if meta contains our branch name or commit SHA
          if (!d.meta) return false;
          
          const matchesBranch = (d.meta.githubCommitRef === gitBranch) || 
                               (d.meta.gitBranch === gitBranch);
          
          const matchesCommit = d.meta.githubCommitSha === commitSha || 
                              d.meta.gitCommitSha === commitSha;
          
          // For PRs, also check PR number
          const matchesPR = isPR && d.meta.githubPr && 
                         d.meta.githubPr.toString() === prNumber.toString();
          
          return matchesBranch || matchesCommit || matchesPR;
        });
        
        if (deployment) {
          console.log(`Found deployment: ${deployment.url} (${deployment.state})`);
          break;
        } else {
          // If we're still not finding the deployment, log all deployment data to help debug
          if (i >= Math.floor(maxRetries / 2)) {
            console.log('Available deployments:');
            deployments.forEach(d => {
              console.log(`- URL: ${d.url}, Created: ${new Date(d.created).toISOString()}`);
              console.log(`  Branch: ${d.meta?.githubCommitRef || d.meta?.gitBranch || 'unknown'}`);
              console.log(`  Commit: ${d.meta?.githubCommitSha || d.meta?.gitCommitSha || 'unknown'}`);
              console.log(`  PR: ${d.meta?.githubPr || 'unknown'}`);
              console.log(`  State: ${d.state}`);
            });
          } else {
            console.log('No matching deployment found yet');
          }
        }
      } catch (error) {
        console.error(`Error fetching deployments: ${error.message}`);
      }
      
      if (i < maxRetries - 1) {
        console.log(`Waiting ${retryInterval/1000} seconds before retry...`);
        await sleep(retryInterval);
      } else {
        throw new Error(`Could not find deployment for branch ${gitBranch} after ${maxRetries} attempts`);
      }
    }
    
    if (!deployment) {
      throw new Error('Failed to locate deployment');
    }
    
    // Check if deployment is already ready
    if (deployment.state === 'READY') {
      console.log('Deployment is already ready!');
      const deploymentUrl = `https://${deployment.url}`;
      core.setOutput('deployment-url', deploymentUrl);
      core.exportVariable('VERCEL_DEPLOYMENT_URL', deploymentUrl);
      console.log(`✅ Vercel deployment is ready at: ${deploymentUrl}`);
      
      // Post comment if it's a PR
      await postCommentIfNeeded(octokit, owner, repo, prNumber, deploymentUrl);
      return;
    }
    
    // Wait for deployment to be ready
    console.log(`Waiting for deployment ${deployment.id} to be ready...`);
    const deploymentId = deployment.id;
    
    for (let i = 0; i < maxRetries; i++) {
      console.log(`Attempt ${i+1}/${maxRetries} to check deployment status...`);
      
      try {
        // Get deployment status
        const statusUrl = `${vercelApiBaseUrl}/v13/deployments/${deploymentId}`;
        const statusParams = vercelTeamId ? `?teamId=${vercelTeamId}` : '';
        
        const response = await fetch(`${statusUrl}${statusParams}`, {
          headers
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get deployment status: ${response.status} ${response.statusText}`);
        }
        
        const deploymentData = await response.json();
        
        console.log(`Deployment state: ${deploymentData.state}`);
        
        if (deploymentData.state === 'READY') {
          const deploymentUrl = `https://${deploymentData.url}`;
          core.setOutput('deployment-url', deploymentUrl);
          core.setOutput('deployment-id', deploymentId);
          core.exportVariable('VERCEL_DEPLOYMENT_URL', deploymentUrl);
          core.exportVariable('VERCEL_DEPLOYMENT_ID', deploymentId);
          console.log(`✅ Vercel deployment is ready at: ${deploymentUrl}`);
          
          // Post comment if it's a PR
          await postCommentIfNeeded(octokit, owner, repo, prNumber, deploymentUrl);
          return;
        } else if (deploymentData.state === 'ERROR') {
          throw new Error('Deployment failed with ERROR state');
        }
      } catch (error) {
        console.error(`Error checking deployment status: ${error.message}`);
      }
      
      if (i < maxRetries - 1) {
        console.log(`Waiting ${retryInterval/1000} seconds before retry...`);
        await sleep(retryInterval);
      } else {
        throw new Error(`Deployment not ready after ${maxRetries} attempts`);
      }
    }
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Post a comment to the PR with test results and deployment URL if needed
 */
async function postCommentIfNeeded(octokit, owner, repo, prNumber, deploymentUrl) {
  // Only post comments on PRs, not on direct pushes
  if (!prNumber || !octokit) {
    console.log('Not posting a comment (not a PR context or missing GitHub token)');
    return;
  }
  
  const { TOTAL, PASSED, FAILED, FLAKY, SKIPPED, REPORT_FOLDER } = process.env;
  
  // If test results are available, create or update a comment
  if (TOTAL) {
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
    [ALL Reports Link](${`https://${owner}.github.io/${repo}`})
    ## Deployment
    [View Deployment](${deploymentUrl})
    ## Additional Information
    Last updated: ${new Date().toUTCString()}
    `;
    
    try {
      // Get all comments for this PR
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      });
      
      // Look for an existing comment that starts with the same title
      const existingComment = comments.find(comment => 
        comment.body.trim().startsWith(commentTitle.trim())
      );
      
      if (existingComment) {
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
          issue_number: prNumber,
          body: commentBody,
        });
        console.log('Comment created successfully');
      }
    } catch (error) {
      console.error(`Error managing PR comment: ${error.message}`);
      // Don't fail the action just because of comment issues
    }
  }
}

// Execute main function
main();
