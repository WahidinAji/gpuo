import { spawn } from 'child_process';
import { commitQueries } from '../db/database';

// Helper function to execute git commands
function executeGitCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string; success: boolean }> {
  return new Promise((resolve) => {
    const process = spawn(command, args, { stdio: 'pipe' });
    
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

export async function gitRoutes(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const method = request.method;

  try {
    // GET /api/git/status - Get git status
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'status') {
      const result = await executeGitCommand('git', ['status', '--porcelain']);
      
      return new Response(JSON.stringify({
        success: result.success,
        output: result.stdout,
        error: result.stderr
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/git/branches - Get all branches
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'branches') {
      const result = await executeGitCommand('git', ['branch', '-a']);
      
      return new Response(JSON.stringify({
        success: result.success,
        branches: result.stdout.split('\n').map(b => b.trim()).filter(b => b),
        error: result.stderr
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/git/commits - Get recent commits
    if (method === 'GET' && pathParts.length === 3 && pathParts[2] === 'commits') {
      const result = await executeGitCommand('git', ['log', '--oneline', '-20']);
      
      const commits = result.stdout.split('\n').map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      }).filter(commit => commit.hash);

      return new Response(JSON.stringify({
        success: result.success,
        commits,
        error: result.stderr
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/git/cherry-pick - Cherry-pick commits
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'cherry-pick') {
      console.log('Cherry-pick request received');
      const body = await request.json();
      const { commitHash, branchName, taskId } = body;

      if (!commitHash || !branchName) {
        return new Response(JSON.stringify({ error: 'Commit hash and branch name are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        // Check if branch exists, create if not
        const branchCheck = await executeGitCommand('git', ['rev-parse', '--verify', branchName]);
        
        if (!branchCheck.success) {
          // Create new branch
          const createBranch = await executeGitCommand('git', ['checkout', '-b', branchName]);
          if (!createBranch.success) {
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to create branch: ${createBranch.stderr}`
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } else {
          // Checkout existing branch
          const checkout = await executeGitCommand('git', ['checkout', branchName]);
          if (!checkout.success) {
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to checkout branch: ${checkout.stderr}`
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // Cherry-pick the commit
        const cherryPick = await executeGitCommand('git', ['cherry-pick', commitHash]);
        
        if (cherryPick.success) {
          // Update commit status in database if taskId is provided
          if (taskId) {
            // Find the commit in the database and update its status
            const commits = commitQueries.getCommitsByTaskId.all(taskId);
            const commit = commits.find(c => c.commit_hash === commitHash);
            if (commit) {
              commitQueries.updateCommitStatus.run('completed', commit.id);
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Cherry-pick successful',
            output: cherryPick.stdout
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: `Cherry-pick failed: ${cherryPick.stderr}`,
            output: cherryPick.stdout
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: `Cherry-pick operation failed: ${error}`
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/git/push - Push branch to origin
    if (method === 'POST' && pathParts.length === 3 && pathParts[2] === 'push') {
      const body = await request.json();
      const { branchName } = body;

      if (!branchName) {
        return new Response(JSON.stringify({ error: 'Branch name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await executeGitCommand('git', ['push', '-u', 'origin', branchName]);
      
      return new Response(JSON.stringify({
        success: result.success,
        message: result.success ? 'Push successful' : 'Push failed',
        output: result.stdout,
        error: result.stderr
      }), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Git routes error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
