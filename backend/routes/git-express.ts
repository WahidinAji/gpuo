import express from 'express';
import { exec } from 'child_process';
import { commitQueries, taskQueries } from '../db/database';
import { executeGitCommand, parseGitCommits } from '../utils/git';

const router = express.Router();

const handleError = (res: express.Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).json({ error: 'Internal server error' });
};

// GET /api/git/status
router.get('/status', async (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }

    const result = await executeGitCommand(['status', '--porcelain'], directory);
    res.json({
      success: result.success,
      output: result.stdout,
      error: result.stderr
    });
  } catch (error) {
    handleError(res, error, 'Error getting git status:');
  }
});

// GET /api/git/branches
router.get('/branches', async (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }

    const result = await executeGitCommand(['branch', '-a'], directory);
    res.json({
      success: result.success,
      branches: result.stdout.split('\n').map(b => b.trim()).filter(b => b),
      error: result.stderr
    });
  } catch (error) {
    handleError(res, error, 'Error getting branches:');
  }
});

// GET /api/git/commits
router.get('/commits', async (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }

    const result = await executeGitCommand(['log', '--oneline', '-20'], directory);
    const commits = parseGitCommits(result.stdout);

    res.json({
      success: result.success,
      commits,
      error: result.stderr
    });
  } catch (error) {
    handleError(res, error, 'Error getting commits:');
  }
});

const execCommand = (command: string, directory: string): Promise<{ stdout: string; stderr: string; success: boolean }> => {
  return new Promise((resolve) => {
    exec(`cd ${directory} && ${command}`, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        success: !error
      });
    });
  });
};

// POST /api/git/cherry-pick
router.post('/cherry-pick', async (req, res) => {
  try {
    const { commitHash, branchName, taskId, directory } = req.body;

    if (!commitHash || !branchName || !directory) {
      return res.status(400).json({ error: 'Commit hash, branch name, and directory are required' });
    }

    // Get current branch
    const currentBranchResult = await execCommand('git branch --show-current', directory);
    if (!currentBranchResult.success) {
      return res.status(500).json({ error: 'Failed to get current branch' });
    }

    const currentBranch = currentBranchResult.stdout.trim();

    // Checkout to target branch if needed
    if (currentBranch !== branchName) {
      const checkoutResult = await execCommand(`git checkout ${branchName}`, directory);
      if (!checkoutResult.success) {
        return res.status(500).json({ error: 'Failed to checkout branch' });
      }
    }

    // Cherry-pick the commit
    const cherryPickResult = await execCommand(`git cherry-pick ${commitHash}`, directory);
    
    if (!cherryPickResult.success) {
      console.log('Cherry-pick error:', cherryPickResult.stderr);

      if( cherryPickResult.stderr.includes('error: Your local changes to the following files would be overwritten by merge')) {
        // Handle local changes conflict
        return res.status(409).json({
          success: false,
          error: 'Local changes conflict',
          // message: 'Your local changes would be overwritten by the cherry-pick. Please commit or stash them first.'
          message: cherryPickResult.stderr,
        });
      }

      // Check if it's a conflict (cherry-pick needs manual resolution)
      if (cherryPickResult.stderr.includes('CONFLICT') || 
          cherryPickResult.stderr.includes('could not apply') ||
          cherryPickResult.stderr.includes('cherry-pick --continue')) {
        
        // Update commit status and message even when there's a conflict
        if (taskId) {
          const commits = commitQueries.getCommitsByTaskId.all(taskId);
          const commit = commits.find((c: any) => c.commit_hash === commitHash) as any;
          
          if (commit) {
            // Get commit info from git log to update message and date
            const commitInfoResult = await execCommand(`git log --format="%s|%ci" -1 ${commitHash}`, directory);
            let commitMessage = commit.commit_message;
            let commitDate = commit.commit_date;
            
            if (commitInfoResult.success && commitInfoResult.stdout) {
              const [message, date] = commitInfoResult.stdout.split('|');
              commitMessage = message || commit.commit_message;
              commitDate = date ? date.trim() : commit.commit_date;
            }
            
            // Update commit with conflict status and proper message/date
            commitQueries.updateCommitDetails.run(
              commitMessage, 
              commitDate, 
              'conflict', 
              commit.id
            );
          }
        }
        
        return res.json({
          success: true,
          hasConflict: true,
          message: 'Cherry-pick has conflicts that need manual resolution',
          conflictMessage: 'There are conflicts, please fix them before pushing',
          output: cherryPickResult.stderr,
          hint: 'After resolving conflicts, you can push or delete this commit'
        });
      }
      
      // Check if nothing to commit (already applied)
      if (cherryPickResult.stderr.includes('nothing to commit')) {
        return res.json({
          success: true,
          message: 'Nothing to commit, cherry-pick already applied',
          output: cherryPickResult.stdout
        });
      }
      
      console.log('Cherry-pick failed sdsd:', cherryPickResult.stderr);
      // Other errors are actual failures
      return res.status(500).json({ 
        success: false, 
        error: `Cherry-pick failed: ${cherryPickResult.stderr}` 
      });
    }

    // Update commit in database
    if (taskId) {
      const commits = commitQueries.getCommitsByTaskId.all(taskId);
      const commit = commits.find((c: any) => c.commit_hash === commitHash) as any;
      
      if (commit) {
        const commitMessageMatch = cherryPickResult.stdout.match(/\[.*?\]\s*(.+)/);
        const parsedCommitMessage = commitMessageMatch ? commitMessageMatch[1].trim() : '';
        
        const dateMatch = cherryPickResult.stdout.match(/Date:\s*(.+)/);
        const parsedCommitDate = dateMatch ? dateMatch[1].trim() : '';
        
        commitQueries.updateCommitDetails.run(
          parsedCommitMessage || commit.commit_message, 
          parsedCommitDate, 
          'ready_to_push', 
          commit.id
        );
      }
    }

    res.json({
      success: true,
      message: 'Cherry-pick successful',
      output: cherryPickResult.stdout
    });
  } catch (error) {
    handleError(res, error, 'Error cherry-picking commit:');
  }
});

// POST /api/git/push
router.post('/push', async (req, res) => {
  try {
    const { branchName, directory, taskId } = req.body;

    if (!branchName || !directory) {
      return res.status(400).json({ error: 'Branch name and directory are required' });
    }

    const pushResult = await execCommand(`git push -u origin ${branchName}`, directory);
    
    if (!pushResult.success) {
      return res.status(500).json({
        success: false,
        error: `Push failed: ${pushResult.stderr}`
      });
    }

    // Update task status after successful push
    if (taskId) {
      try {
        taskQueries.updateTaskStatus.run('completed', taskId);
      } catch (dbError) {
        console.error('Error updating task status:', dbError);
      }
    }
    
    res.json({
      success: true,
      message: 'Push successful',
      output: pushResult.stdout
    });
  } catch (error) {
    handleError(res, error, 'Error pushing branch:');
  }
});

// POST /api/git/push-commit
router.post('/push-commit', async (req, res) => {
  try {
    const { commitHash, branchName, directory, taskId, commitId } = req.body;

    if (!commitHash || !branchName || !directory || !commitId) {
      return res.status(400).json({ error: 'Commit hash, branch name, directory, and commit ID are required' });
    }

    // Get current branch and checkout if needed
    const currentBranchResult = await execCommand('git branch --show-current', directory);
    if (!currentBranchResult.success) {
      return res.status(500).json({ error: 'Failed to get current branch' });
    }

    const currentBranch = currentBranchResult.stdout.trim();
    
    if (currentBranch !== branchName) {
      const checkoutResult = await execCommand(`git checkout ${branchName}`, directory);
      if (!checkoutResult.success) {
        return res.status(500).json({ error: 'Failed to checkout branch' });
      }
    }

    // Push the commit
    const pushResult = await execCommand(`git push -u origin ${branchName}`, directory);
    
    if (!pushResult.success) {
      return res.status(500).json({
        success: false,
        error: `Push failed: ${pushResult.stderr}`
      });
    }

    // Update commit status
    try {
      commitQueries.updateCommitStatus.run('pushed', commitId);
      
      // Check if all commits are pushed, then mark task as completed
      if (taskId) {
        const commits = commitQueries.getCommitsByTaskId.all(taskId);
        const allPushed = commits.every((c: any) => c.status === 'pushed');
        
        if (allPushed) {
          taskQueries.updateTaskStatus.run('completed', taskId);
        }
      }
    } catch (dbError) {
      console.error('Error updating commit/task status:', dbError);
    }
    
    res.json({
      success: true,
      message: 'Commit push successful',
      output: pushResult.stdout
    });
  } catch (error) {
    handleError(res, error, 'Error pushing commit:');
  }
});

// POST /api/git/cherry-pick-abort - Abort cherry-pick operation
router.post('/cherry-pick-abort', async (req, res) => {
  try {
    const { directory, taskId, commitId } = req.body;

    if (!directory) {
      return res.status(400).json({ error: 'Directory is required' });
    }

    const abortResult = await execCommand('git cherry-pick --abort', directory);
    
    if (!abortResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to abort cherry-pick: ${abortResult.stderr}`
      });
    }

    // Update commit status back to pending
    if (taskId && commitId) {
      try {
        commitQueries.updateCommitStatus.run('pending', commitId);
      } catch (dbError) {
        console.error('Error updating commit status:', dbError);
      }
    }

    res.json({
      success: true,
      message: 'Cherry-pick aborted successfully',
      output: abortResult.stdout
    });
  } catch (error) {
    handleError(res, error, 'Error aborting cherry-pick:');
  }
});

// POST /api/git/cherry-pick-continue - Continue cherry-pick after resolving conflicts
router.post('/cherry-pick-continue', async (req, res) => {
  try {
    const { directory, taskId, commitId } = req.body;

    if (!directory) {
      return res.status(400).json({ error: 'Directory is required' });
    }

    // First add all resolved files
    const addResult = await execCommand('git add .', directory);
    if (!addResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to add resolved files: ${addResult.stderr}`
      });
    }

    // Continue cherry-pick
    const continueResult = await execCommand('git cherry-pick --continue', directory);
    
    if (!continueResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to continue cherry-pick: ${continueResult.stderr}`
      });
    }

    // Update commit status to ready_to_push
    if (taskId && commitId) {
      try {
        commitQueries.updateCommitStatus.run('ready_to_push', commitId);
      } catch (dbError) {
        console.error('Error updating commit status:', dbError);
      }
    }

    res.json({
      success: true,
      message: 'Cherry-pick continued successfully',
      output: continueResult.stdout
    });
  } catch (error) {
    handleError(res, error, 'Error continuing cherry-pick:');
  }
});

// GET /api/git/conflict-status - Check detailed conflict status with user-friendly messages
router.get('/conflict-status', async (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }

    // Get full git status with more details
    const statusResult = await execCommand('git status', directory);
    
    if (!statusResult.success) {
      return res.status(500).json({
        success: false,
        error: `Failed to get git status: ${statusResult.stderr}`
      });
    }

    const statusOutput = statusResult.stdout;
    
    // Check if cherry-pick is in progress
    const cherryPickInProgress = statusOutput.includes('currently cherry-picking');
    
    // Check for different conflict states
    const hasUnmergedPaths = statusOutput.includes('Unmerged paths:');
    const allConflictsFixed = statusOutput.includes('all conflicts fixed: run "git cherry-pick --continue"');
    const hasConflicts = hasUnmergedPaths && !allConflictsFixed;
    
    // Extract conflicted files with better parsing
    const conflictedFiles: string[] = [];
    if (hasUnmergedPaths) {
      const lines = statusOutput.split('\n');
      let inUnmergedSection = false;
      
      for (const line of lines) {
        if (line.includes('Unmerged paths:')) {
          inUnmergedSection = true;
          continue;
        }
        
        if (inUnmergedSection && line.trim() === '') {
          break;
        }
        
        if (inUnmergedSection) {
          // Handle different conflict indicators
          if (line.includes('both modified:')) {
            const file = line.split('both modified:')[1]?.trim();
            if (file) conflictedFiles.push(file);
          } else if (line.includes('added by us:')) {
            const file = line.split('added by us:')[1]?.trim();
            if (file) conflictedFiles.push(file);
          } else if (line.includes('added by them:')) {
            const file = line.split('added by them:')[1]?.trim();
            if (file) conflictedFiles.push(file);
          } else if (line.includes('deleted by us:')) {
            const file = line.split('deleted by us:')[1]?.trim();
            if (file) conflictedFiles.push(file);
          } else if (line.includes('deleted by them:')) {
            const file = line.split('deleted by them:')[1]?.trim();
            if (file) conflictedFiles.push(file);
          }
        }
      }
    }

    // Extract current commit being cherry-picked
    let currentCommit = '';
    const commitMatch = statusOutput.match(/You are currently cherry-picking commit ([a-f0-9]+)/);
    if (commitMatch) {
      currentCommit = commitMatch[1];
    }

    // Extract branch information
    let currentBranch = '';
    const branchMatch = statusOutput.match(/Your branch is up to date with '([^']+)'/);
    if (branchMatch) {
      currentBranch = branchMatch[1];
    } else {
      // Alternative pattern for branch name
      const branchMatch2 = statusOutput.match(/On branch (.+)/);
      if (branchMatch2) {
        currentBranch = branchMatch2[1];
      }
    }

    // Determine status message with more context
    let statusMessage = '';
    let detailedMessage = '';
    let canContinue = false;
    let needsResolution = false;
    let userAction = '';
    
    if (cherryPickInProgress) {
      if (allConflictsFixed) {
        statusMessage = 'All conflicts have been resolved';
        detailedMessage = 'All conflicts have been resolved. You can now continue the cherry-pick operation.';
        userAction = 'Click "Continue" to complete the cherry-pick, then return to the app to push the commit.';
        canContinue = true;
      } else if (hasConflicts) {
        statusMessage = `Cherry-pick has ${conflictedFiles.length} unresolved conflict(s)`;
        detailedMessage = `There are ${conflictedFiles.length} file(s) with unresolved conflicts that need manual resolution.`;
        userAction = 'Please resolve the conflicts in your code editor, then use "git add <file>" to mark them as resolved, and return to the app to continue.';
        needsResolution = true;
      } else {
        statusMessage = 'Cherry-pick operation is in progress';
        detailedMessage = 'Cherry-pick operation is in progress but status is unclear.';
        userAction = 'Please check the git status manually or contact support.';
      }
    } else {
      statusMessage = 'No cherry-pick operation in progress';
      detailedMessage = 'No cherry-pick operation is currently in progress.';
      userAction = 'You can safely proceed with other operations.';
    }

    // Build formatted status output for display
    let formattedStatusOutput = '';
    if (cherryPickInProgress) {
      formattedStatusOutput += `Status: ${statusMessage}\n\n`;
      
      if (currentBranch) {
        formattedStatusOutput += `Branch: ${currentBranch}\n`;
      }
      
      if (currentCommit) {
        formattedStatusOutput += `Cherry-picking commit: ${currentCommit}\n\n`;
      }
      
      if (needsResolution && conflictedFiles.length > 0) {
        formattedStatusOutput += `Files with conflicts:\n`;
        conflictedFiles.forEach(file => {
          formattedStatusOutput += `  • ${file}\n`;
        });
        formattedStatusOutput += `\n`;
      }
      
      formattedStatusOutput += `Next steps: ${userAction}`;
    } else {
      formattedStatusOutput = statusMessage;
    }

    res.json({
      success: true,
      cherryPickInProgress,
      hasConflicts,
      allConflictsFixed,
      conflictedFiles,
      currentCommit,
      currentBranch,
      statusMessage,
      detailedMessage,
      userAction,
      formattedStatusOutput,
      canContinue,
      needsResolution,
      rawStatusOutput: statusOutput
    });
  } catch (error) {
    handleError(res, error, 'Error checking conflict status:');
  }
});

export { router as gitRoutes };
