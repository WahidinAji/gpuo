import { spawn } from 'child_process';

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  success: boolean;
}

export function executeGitCommand(args: string[], cwd?: string): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    const gitProcess = spawn('git', args, { 
      stdio: 'pipe', 
      cwd,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:/usr/bin:/usr/local/bin:/opt/homebrew/bin`
      }
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

export function parseGitCommits(stdout: string) {
  return stdout.split('\n').map(line => {
    const [hash, ...messageParts] = line.split(' ');
    return {
      hash,
      message: messageParts.join(' ')
    };
  }).filter(commit => commit.hash);
}
