import express from 'express';
import { spawn, exec } from 'child_process';
import { commitQueries, taskQueries } from '../db/database';

const router = express.Router();

// Helper function to get git command path
function getGitCommand(): string {
  // For macOS, prioritize Homebrew path
  if (process.platform === 'darwin') {
    return '/opt/homebrew/bin/git';
  }
  
  return 'git';
}

// Helper function to execute git commands in a specific directory
function executeGitCommand(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  return new Promise((resolve) => {
    const gitCommand = getGitCommand();
    
    // Set up environment to include common paths
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${process.env.PATH}:/usr/bin:/usr/local/bin:/opt/homebrew/bin`
    };
    
    const gitProcess = spawn(gitCommand, args, { 
      stdio: 'pipe', 
      cwd,
      env
    });
    
    let stdout = '';
    let stderr = '';
    
    gitProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    gitProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    gitProcess.on('close', (code: number | null) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
      });
    });
    
    gitProcess.on('error', (error: Error) => {
      resolve({
        stdout: '',
        stderr: `Failed to execute git command: ${error.message}`,
        success: false
      });
    });
  });
}

// GET /api/git/status - Get git status
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
    console.error('Error getting git status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/git/branches - Get all branches
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
    console.error('Error getting branches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/git/commits - Get recent commits
router.get('/commits', async (req, res) => {
  try {
    const { directory } = req.query;
    
    if (!directory || typeof directory !== 'string') {
      return res.status(400).json({ error: 'Directory parameter is required' });
    }

    const result = await executeGitCommand(['log', '--oneline', '-20'], directory);
    
    const commits = result.stdout.split('\n').map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return {
        hash,
        message: messageParts.join(' ')
      };
    }).filter(commit => commit.hash);

    res.json({
      success: result.success,
      commits,
      error: result.stderr
    });
  } catch (error) {
    console.error('Error getting commits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/git/cherry-pick - Cherry-pick commits
router.post('/cherry-pick', async (req, res) => {
  console.log('Cherry-pick request received');
  try {
    const { commitHash, branchName, taskId, directory } = req.body;

    if (!commitHash || !branchName || !directory) {
      return res.status(400).json({ error: 'Commit hash, branch name, and directory are required' });
    }

    /**
     * check the current branch. if current branch is not the same as branchName, checkout to branchName and no return anything if success and continue to the last step
     * if branchName is same as current branch, skip checkout and continue to the last step
     */

    // Get current branch
    exec(`cd ${directory} && git branch --show-current`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: `Failed to get current branch: ${error.message}` });
      }
      if (stderr) {
        return res.status(500).json({ error: `Failed to get current branch: ${stderr}` });
      }

      const currentBranch = stdout.trim();
      console.log(`Current branch: ${currentBranch}`);
      console.log(`Target branch: ${branchName}`);
      console.log('Compare branches:', currentBranch === branchName, currentBranch !== branchName);
      
      if (currentBranch !== branchName) {
        // Checkout to target branch
        exec(`cd ${directory} && git checkout ${branchName}`, (checkoutError, _checkoutStdout, checkoutStderr) => {
          console.log("checkoutStderr:", checkoutStderr);
          if (checkoutError) {
            return res.status(500).json({ error: `Failed to checkout branch checkoutError: ${checkoutError.message}` });
          }
          if(checkoutStderr && !checkoutStderr.includes(`Switched to branch '${branchName}'`)){
            return res.status(500).json({ error: `Failed to checkout branch checkoutStderr: ${checkoutStderr}` });
          }
          
          // Now cherry-pick
          performCherryPick();
        });
      } else {
        // Already on target branch, proceed with cherry-pick
        performCherryPick();
      }
    });

    function performCherryPick() {
      exec(`cd ${directory} && git cherry-pick ${commitHash}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Git cherry-pick error:', error);
          if (stderr && stderr.includes('nothing to commit')) {
            return res.status(200).json({
              success: true,
              message: 'Nothing to commit, cherry-pick already applied',
              output: stdout
            });
          }
          return res.status(500).json({ 
            success: false, 
            error: `Command failed: ${error.message}` 
          });
        }
        
        if (stderr) {
          console.error('Git cherry-pick stderr:', stderr);
          return res.status(500).json({
            success: false,
            error: `Cherry-pick failed: ${stderr}`
          });
        }
        
        console.log('Git cherry-pick stdout:', stdout);
        
        // Parse commit message and date from cherry-pick output
        let parsedCommitMessage = '';
        let parsedCommitDate = '';
        
        if (stdout) {
          // Extract commit message from lines like: [tocp 042d583] docs: update README with additional content
          const commitMessageMatch = stdout.match(/\[.*?\]\s*(.+)/);
          if (commitMessageMatch) {
            parsedCommitMessage = commitMessageMatch[1].trim();
          }
          
          // Extract date from lines like: Date: Wed Jul 16 19:59:42 2025 +0700
          const dateMatch = stdout.match(/Date:\s*(.+)/);
          if (dateMatch) {
            parsedCommitDate = dateMatch[1].trim();
          }
        }
        
        console.log('Parsed commit message:', parsedCommitMessage);
        console.log('Parsed commit date:', parsedCommitDate);
        
        if (taskId) {
          // Find the commit in the database and update its status, message, and date
          const commits = commitQueries.getCommitsByTaskId.all(taskId);
          const commit = commits.find((c: any) => c.commit_hash === commitHash) as any;
          if (commit) {
            // Update with parsed information
            commitQueries.updateCommitDetails.run(
              parsedCommitMessage || commit.commit_message, 
              parsedCommitDate, 
              'ready_to_push', 
              commit.id
            );
            console.log(`Updated commit ${commit.id} with message: "${parsedCommitMessage}" and date: "${parsedCommitDate}"`);
          }
        }

        res.json({
          success: true,
          message: 'Cherry-pick successful',
          output: stdout
        });
      });
    }

    // // Check if branch exists, create if not
    // const branchCheck = await executeGitCommand(['rev-parse', '--verify', branchName], directory);
    
    // if (!branchCheck.success) {
    //   // Create new branch
    //   const createBranch = await executeGitCommand(['checkout', '-b', branchName], directory);
    //   if (!createBranch.success) {
    //     return res.status(500).json({
    //       success: false,
    //       error: `Failed to create branch: ${createBranch.stderr}`
    //     });
    //   }
    // } else {
    //   // Checkout existing branch
    //   const checkout = await executeGitCommand(['checkout', branchName], directory);
    //   if (!checkout.success) {
    //     return res.status(500).json({
    //       success: false,
    //       error: `Failed to checkout branch: ${checkout.stderr}`
    //     });
    //   }
    // }

    // // Cherry-pick the commit
    // const cherryPick = await executeGitCommand(['cherry-pick', commitHash], directory);
    
    // if (cherryPick.success) {
    //   // Update commit status in database if taskId is provided
    //   if (taskId) {
    //     // Find the commit in the database and update its status
    //     const commits = commitQueries.getCommitsByTaskId.all(taskId);
    //     const commit = commits.find((c: any) => c.commit_hash === commitHash) as any;
    //     if (commit) {
    //       commitQueries.updateCommitStatus.run('completed', commit.id);
    //     }
    //   }

    //   res.json({
    //     success: true,
    //     message: 'Cherry-pick successful',
    //     output: cherryPick.stdout
    //   });
    // } else {
    //   res.status(500).json({
    //     success: false,
    //     error: `Cherry-pick failed: ${cherryPick.stderr}`,
    //     output: cherryPick.stdout
    //   });
    // }
  } catch (error) {
    console.error('Error cherry-picking commit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/git/push - Push branch to origin
router.post('/push', async (req, res) => {
  try {
    const { branchName, directory, taskId } = req.body;

    if (!branchName || !directory) {
      return res.status(400).json({ error: 'Branch name and directory are required' });
    }

    exec(`cd ${directory} && git push -u origin ${branchName}`, (error, stdout, stderr) => {

      console.log("Pushing branch:", branchName);
      console.log("Directory:", directory);
      console.log("error:", error);
      console.log("stdout:", stdout);
      console.log("stderr:", stderr);

      console.log(stderr !== 'Everything up-to-date');
      console.log(stderr.length, stderr.includes('Everything up-to-date'));


      if (error) {
        console.error('Git push error:', error);
        return res.status(500).json({ error: `Failed to push branch: ${error.message}` });
      }

      let checkError = true;
      if(stderr){
        if (stderr.includes('Everything up-to-date') || stderr.includes(`/${directory}.git`)) {
          console.log('Push successful, no changes to push');
          checkError = false;
        }
      }
      if(stdout && stdout.includes(`branch '${branchName}' set up to track 'origin/${branchName}'`)){
        console.log('Push successful, no changes to push');
        checkError = false;
      }
      if(checkError) {
        return res.status(500).json({
          success: false,
          error: `Push failed: ${stderr}`
        });
      }

      console.log('Git push stdout:', stdout);
      
      console.log("taskId:", taskId);
      // Update task status to completed after successful push
      if (taskId) {
        try {
          taskQueries.updateTaskStatus.run('completed', taskId);
          console.log(`Task ${taskId} marked as completed`);
        } catch (dbError) {
          console.error('Error updating task status:', dbError);
          // Don't fail the push response if DB update fails
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Push successful',
        output: stdout
      });
    });
  } catch (error) {
    console.error('Error pushing branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/git/push-commit - Push a single commit
router.post('/push-commit', async (req, res) => {
  try {
    const { commitHash, branchName, directory, taskId, commitId } = req.body;

    if (!commitHash || !branchName || !directory || !commitId) {
      return res.status(400).json({ error: 'Commit hash, branch name, directory, and commit ID are required' });
    }

    // First, ensure we're on the correct branch
    exec(`cd ${directory} && git branch --show-current`, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ error: `Failed to get current branch: ${error.message}` });
      }
      if (stderr) {
        return res.status(500).json({ error: `Failed to get current branch: ${stderr}` });
      }

      const currentBranch = stdout.trim();
      console.log(`Current branch: ${currentBranch}`);
      console.log(`Target branch: ${branchName}`);
      
      if (currentBranch !== branchName) {
        // Checkout to target branch
        exec(`cd ${directory} && git checkout ${branchName}`, (checkoutError, _checkoutStdout, _checkoutStderr) => {
          if (checkoutError) {
            return res.status(500).json({ error: `Failed to checkout branch: ${checkoutError.message}` });
          }
          
          // Now push the commit
          performPushCommit();
        });
      } else {
        // Already on target branch, proceed with push
        performPushCommit();
      }
    });

    function performPushCommit() {
      exec(`cd ${directory} && git push -u origin ${branchName}`, (error, stdout, stderr) => {
        console.log(`Pushing commit ${commitHash} to branch ${branchName}`);
        console.log("Directory:", directory);
        console.log("error:", error);
        console.log("stdout:", stdout);
        console.log("stderr:", stderr);

        if (error) {
          console.error('Git push error:', error);
          return res.status(500).json({ error: `Failed to push commit: ${error.message}` });
        }

        let checkError = true;
        if(stderr){
          if (stderr.includes('Everything up-to-date') || stderr.includes(`/${directory}.git`)) {
            console.log('Push successful, no changes to push');
            checkError = false;
          }
        }
        if(stdout && stdout.includes(`branch '${branchName}' set up to track 'origin/${branchName}'`)){
          console.log('Push successful');
          checkError = false;
        }
        if(checkError) {
          return res.status(500).json({
            success: false,
            error: `Push failed: ${stderr}`
          });
        }

        console.log('Git push stdout:', stdout);
        
        // Update commit status to pushed after successful push
        try {
          commitQueries.updateCommitStatus.run('pushed', commitId);
          console.log(`Commit ${commitId} marked as pushed`);
        } catch (dbError) {
          console.error('Error updating commit status:', dbError);
          // Don't fail the push response if DB update fails
        }

        // Check if all commits in the task are pushed, then mark task as completed
        if (taskId) {
          try {
            const commits = commitQueries.getCommitsByTaskId.all(taskId);
            const allPushed = commits.every((c: any) => c.status === 'pushed');
            
            if (allPushed) {
              taskQueries.updateTaskStatus.run('completed', taskId);
              console.log(`Task ${taskId} marked as completed - all commits pushed`);
            }
          } catch (dbError) {
            console.error('Error updating task status:', dbError);
          }
        }
        
        res.status(200).json({
          success: true,
          message: 'Commit push successful',
          output: stdout
        });
      });
    }
  } catch (error) {
    console.error('Error pushing commit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as gitRoutes };
