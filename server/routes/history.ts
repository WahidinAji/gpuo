import { Router } from 'express';
import { getGitActions } from '../db/setup';

const router = Router();

// Get git actions history
router.get('/', async (req, res) => {
  try {
    const actions = await getGitActions();
    res.json({ actions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get git actions history' });
  }
});

export { router as historyRoutes };
