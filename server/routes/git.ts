import { Router } from 'express';
import { GitService } from '../services/git';
import { z } from 'zod';

const router = Router();
const gitService = new GitService();

// Schema validation
const cherryPickSchema = z.object({
  commits: z.array(z.string()),
  targetBranch: z.string()
});

// Get current branch
router.get('/current-branch', async (req, res) => {
  try {
    const branch = await gitService.getCurrentBranch();
    res.json({ branch });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get current branch' });
  }
});

// Get commit history
router.get('/commits', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const commits = await gitService.getCommitHistory(limit);
    res.json({ commits });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get commit history' });
  }
});

// Cherry-pick and push
router.post('/cherry-pick-push', async (req, res) => {
  try {
    const { commits, targetBranch } = cherryPickSchema.parse(req.body);
    const result = await gitService.cherryPickAndPush(commits, targetBranch);
    
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request data', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Refresh git data
router.post('/refresh', async (req, res) => {
  try {
    await gitService.refreshBranches();
    res.json({ success: true, message: 'Git data refreshed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh git data' });
  }
});

export { router as gitRoutes };
