import { simpleGit, SimpleGit } from 'simple-git';
import { insertGitAction, updateGitAction, insertBranch } from '../db/setup';

export class GitService {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  async getAllBranches(): Promise<{ local: string[], remote: string[] }> {
    const branches = await this.git.branch(['-a']);
    const local = branches.all.filter(branch => !branch.includes('remotes/'));
    const remote = branches.all.filter(branch => branch.includes('remotes/'));
    
    return { local, remote };
  }

  async cherryPickAndPush(commits: string[], targetBranch: string): Promise<{ success: boolean, message: string }> {
    const actionId = await insertGitAction({
      branch: targetBranch,
      commits: commits.join(','),
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    try {
      // Create and checkout new branch
      await this.git.checkoutBranch(targetBranch, 'main');
      
      // Cherry-pick commits
      for (const commit of commits) {
        await this.git.cherry([commit]);
      }

      // Push to remote
      await this.git.push('origin', targetBranch, { '--set-upstream': null });

      await updateGitAction(actionId, {
        status: 'success',
        timestamp: new Date().toISOString()
      });

      return { success: true, message: `Successfully cherry-picked and pushed to ${targetBranch}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await updateGitAction(actionId, {
        status: 'error',
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      });

      return { success: false, message: errorMessage };
    }
  }

  async getCommitHistory(limit: number = 50): Promise<any[]> {
    const log = await this.git.log({ maxCount: limit });
    return log.all;
  }

  async refreshBranches(): Promise<void> {
    const { local, remote } = await this.getAllBranches();
    
    // Store local branches
    for (const branch of local) {
      const log = await this.git.log({ from: branch, maxCount: 1 });
      const lastCommit = log.latest?.hash || '';
      
      await insertBranch({
        name: branch,
        is_remote: false,
        last_commit: lastCommit,
        timestamp: new Date().toISOString()
      });
    }

    // Store remote branches
    for (const branch of remote) {
      const cleanName = branch.replace('remotes/origin/', '');
      const log = await this.git.log({ from: branch, maxCount: 1 });
      const lastCommit = log.latest?.hash || '';
      
      await insertBranch({
        name: cleanName,
        is_remote: true,
        last_commit: lastCommit,
        timestamp: new Date().toISOString()
      });
    }
  }
}
