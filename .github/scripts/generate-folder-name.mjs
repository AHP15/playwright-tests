import { context } from '@actions/github';
import { setOutput } from '@actions/core';

const today = new Date();
const currentDate = today.toISOString()
  .replace('T', '-')
  .replace(/:/g, '-')
  .split('.')[0]; // YYYY-MM-DD-HH-MM-SS format
console.log(`Current Date (UTC): ${currentDate}`);
  
// Determine the prefix based on the event type
let prefix;
if (context.eventName === 'pull_request') {
  prefix = `pr-${context.payload.pull_request.number}`;
} else {
  // Use the branch name (github.ref_name)
  // Sanitize branch name: replace '/' with '-' for safer directory names
  const branchName = context.ref.replace('refs/heads/', '').replace(/\//g, '-');
  prefix = branchName;
}
console.log(`Directory Prefix: ${prefix}`);
  
// Combine prefix and date for the destination directory
const destDir = `${prefix}/${currentDate}`;
console.log(`Final Destination Directory: ${destDir}`);
  
// Set the calculated directory path as an output variable
setOutput('folder_name', destDir);
