import express from 'express';
import { repositoryQueries } from '../db/database';
import { spawn } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const router = express.Router();

// Helper function to validate git repository
function isValidGitRepository(path: string): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Check if directory exists
    if (!existsSync(path)) {
      resolve({ valid: false, error: 'Directory does not exist' });
      return;
    }

    // Check if it's a directory
    if (!statSync(path).isDirectory()) {
      resolve({ valid: false, error: 'Path is not a directory' });
      return;
    }

    // Check if .git directory exists
    const gitDir = join(path, '.git');
    if (!existsSync(gitDir)) {
      resolve({ valid: false, error: 'Not a git repository (no .git directory found)' });
      return;
    }

    // Run git status to verify it's a valid git repository
    const process = spawn('git', ['status'], { cwd: path, stdio: 'pipe' });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ valid: true });
      } else {
        resolve({ valid: false, error: 'Invalid git repository' });
      }
    });

    process.on('error', (error) => {
      resolve({ valid: false, error: `Git command failed: ${error.message}` });
    });
  });
}

// GET /api/repositories - Get all repositories
router.get('/', (req, res) => {
  try {
    const repositories = repositoryQueries.getAllRepositories.all();
    res.json(repositories);
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/repositories/active - Get active repository
router.get('/active', (req, res) => {
  try {
    const activeRepo = repositoryQueries.getActiveRepository.get();
    if (!activeRepo) {
      return res.status(404).json({ error: 'No active repository found' });
    }
    res.json(activeRepo);
  } catch (error) {
    console.error('Error fetching active repository:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/repositories/validate - Validate git repository
router.post('/validate', async (req, res) => {
  try {
    const { path } = req.body;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const validation = await isValidGitRepository(path);
    res.json(validation);
  } catch (error) {
    console.error('Error validating repository:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/repositories - Create new repository
router.post('/', async (req, res) => {
  try {
    const { name, path } = req.body;

    if (!name || !path) {
      return res.status(400).json({ error: 'Name and path are required' });
    }

    // Validate the repository first
    const validation = await isValidGitRepository(path);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if repository with this path already exists
    const existingRepos = repositoryQueries.getAllRepositories.all();
    const existingRepo = existingRepos.find((repo: any) => repo.path === path);
    if (existingRepo) {
      return res.status(409).json({ error: 'Repository with this path already exists' });
    }

    // If this is the first repository, make it active
    const isFirstRepo = existingRepos.length === 0;

    const result = repositoryQueries.createRepository.run(name, path, isFirstRepo ? 1 : 0);
    const newRepo = repositoryQueries.getRepositoryById.get(result.lastInsertRowid);

    res.status(201).json(newRepo);
  } catch (error) {
    console.error('Error creating repository:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/repositories/:id/activate - Set repository as active
router.post('/:id/activate', (req, res) => {
  try {
    const repoId = parseInt(req.params.id);
    
    const existingRepo = repositoryQueries.getRepositoryById.get(repoId);
    if (!existingRepo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Deactivate all repositories first
    repositoryQueries.setActiveRepository.run();
    
    // Set the specified repository as active
    repositoryQueries.setRepositoryActive.run(repoId);

    const updatedRepo = repositoryQueries.getRepositoryById.get(repoId);
    res.json(updatedRepo);
  } catch (error) {
    console.error('Error setting active repository:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/repositories/:id - Delete repository
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
    console.error('Error deleting repository:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as repositoryRoutes };
