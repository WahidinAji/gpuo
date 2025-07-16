import express from 'express';
import { spawn } from 'child_process';
import { commitQueries } from '../db/database';

const router = express.Router();

// Helper function to execute git commands in a specific directory
function executeGitCommand(command: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  return new Promise((resolve) => {
    const process = spawn(command, args, { stdio: 'pipe', cwd });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0
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

    const result = await executeGitCommand('git', ['status', '--porcelain'], directory);
    
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

    const result = await executeGitCommand('git', ['branch', '-a'], directory);
    
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

    const result = await executeGitCommand('git', ['log', '--oneline', '-20'], directory);
    
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
  try {
    const repoPath = getRepositoryPath();
    if (!repoPath) {
      return res.status(400).json({ error: 'No active repository configured' });
    }

    const { commitHash, branchName, taskId } = req.body;

    if (!commitHash || !branchName) {
      return res.status(400).json({ error: 'Commit hash and branch name are required' });
    }

    // Check if branch exists, create if not
    const branchCheck = await executeGitCommand('git', ['rev-parse', '--verify', branchName], repoPath);
    
    if (!branchCheck.success) {
      // Create new branch
      const createBranch = await executeGitCommand('git', ['checkout', '-b', branchName], repoPath);
      if (!createBranch.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to create branch: ${createBranch.stderr}`
        });
      }
    } else {
      // Checkout existing branch
      const checkout = await executeGitCommand('git', ['checkout', branchName], repoPath);
      if (!checkout.success) {
        return res.status(500).json({
          success: false,
          error: `Failed to checkout branch: ${checkout.stderr}`
        });
      }
    }

    // Cherry-pick the commit
    const cherryPick = await executeGitCommand('git', ['cherry-pick', commitHash], repoPath);
    
    if (cherryPick.success) {
      // Update commit status in database if taskId is provided
      if (taskId) {
        // Find the commit in the database and update its status
        const commits = commitQueries.getCommitsByTaskId.all(taskId);
        const commit = commits.find((c: any) => c.commit_hash === commitHash);
        if (commit) {
          commitQueries.updateCommitStatus.run('completed', commit.id);
        }
      }

      res.json({
        success: true,
        message: 'Cherry-pick successful',
        output: cherryPick.stdout
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Cherry-pick failed: ${cherryPick.stderr}`,
        output: cherryPick.stdout
      });
    }
  } catch (error) {
    console.error('Error cherry-picking:', error);
    res.status(500).json({
      success: false,
      error: `Cherry-pick operation failed: ${error}`
    });
  }
});

// POST /api/git/push - Push branch to origin
router.post('/push', async (req, res) => {
  try {
    const repoPath = getRepositoryPath();
    if (!repoPath) {
      return res.status(400).json({ error: 'No active repository configured' });
    }

    const { branchName } = req.body;

    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    const result = await executeGitCommand('git', ['push', '-u', 'origin', branchName], repoPath);
    
    res.status(result.success ? 200 : 500).json({
      success: result.success,
      message: result.success ? 'Push successful' : 'Push failed',
      output: result.stdout,
      error: result.stderr
    });
  } catch (error) {
    console.error('Error pushing branch:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as gitRoutes };
