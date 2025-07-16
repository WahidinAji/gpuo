import express from 'express';
import { repositoryQueries } from '../db/database.js';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const router = express.Router();

const handleError = (res: express.Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).json({ error: 'Internal server error' });
};

function isValidGitRepository(path: string): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (!existsSync(path)) {
      resolve({ valid: false, error: 'Directory does not exist' });
      return;
    }

    if (!statSync(path).isDirectory()) {
      resolve({ valid: false, error: 'Path is not a directory' });
      return;
    }

    const gitDir = join(path, '.git');
    if (!existsSync(gitDir)) {
      resolve({ valid: false, error: 'Not a git repository (no .git directory found)' });
      return;
    }

    const process = spawn('git', ['status'], { cwd: path, stdio: 'pipe' });
    
    process.on('close', (code) => {
      resolve({ valid: code === 0, error: code !== 0 ? 'Invalid git repository' : undefined });
    });

    process.on('error', (error) => {
      resolve({ valid: false, error: `Git command failed: ${error.message}` });
    });
  });
}

// GET /api/repositories
router.get('/', (_req, res) => {
  try {
    const repositories = repositoryQueries.getAllRepositories.all();
    res.json(repositories);
  } catch (error) {
    handleError(res, error, 'Error fetching repositories:');
  }
});

// GET /api/repositories/active
router.get('/active', (_req, res) => {
  try {
    const activeRepo = repositoryQueries.getActiveRepository.get();
    if (!activeRepo) {
      return res.status(404).json({ error: 'No active repository found' });
    }
    res.json(activeRepo);
  } catch (error) {
    handleError(res, error, 'Error fetching active repository:');
  }
});

// POST /api/repositories/validate
router.post('/validate', async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const validation = await isValidGitRepository(path);
    res.json(validation);
  } catch (error) {
    handleError(res, error, 'Error validating repository:');
  }
});

// POST /api/repositories
router.post('/', async (req, res) => {
  try {
    const { name, path } = req.body;

    if (!name || !path) {
      return res.status(400).json({ error: 'Name and path are required' });
    }

    const validation = await isValidGitRepository(path);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const existingRepos = repositoryQueries.getAllRepositories.all();
    const existingRepo = existingRepos.find((repo: any) => repo.path === path);
    if (existingRepo) {
      return res.status(409).json({ error: 'Repository with this path already exists' });
    }

    const isFirstRepo = existingRepos.length === 0;
    const result = repositoryQueries.createRepository.run(name, path, isFirstRepo ? 1 : 0);
    const newRepo = repositoryQueries.getRepositoryById.get(result.lastInsertRowid);

    res.status(201).json(newRepo);
  } catch (error) {
    handleError(res, error, 'Error creating repository:');
  }
});

// POST /api/repositories/:id/activate
router.post('/:id/activate', (req, res) => {
  try {
    const repoId = parseInt(req.params.id);
    
    const existingRepo = repositoryQueries.getRepositoryById.get(repoId);
    if (!existingRepo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    repositoryQueries.setActiveRepository.run();
    repositoryQueries.setRepositoryActive.run(repoId);

    const updatedRepo = repositoryQueries.getRepositoryById.get(repoId);
    res.json(updatedRepo);
  } catch (error) {
    handleError(res, error, 'Error setting active repository:');
  }
});

// DELETE /api/repositories/:id
router.delete('/:id', (req, res) => {
  try {
    const repoId = parseInt(req.params.id);
    
    const existingRepo = repositoryQueries.getRepositoryById.get(repoId);
    if (!existingRepo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    repositoryQueries.deleteRepository.run(repoId);
    res.json({ message: 'Repository deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Error deleting repository:');
  }
});

export { router as repositoryRoutes };
