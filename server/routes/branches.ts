import { Router } from 'express';
import { getBranches } from '../db/setup';

const router = Router();

// Get all branches
router.get('/', async (req, res) => {
  try {
    const branches = await getBranches();
    res.json({ branches });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get branches' });
  }
});

export { router as branchRoutes };
