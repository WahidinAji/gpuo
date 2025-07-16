import express from 'express';
import { taskQueries, commitQueries } from '../db/database.js';
import { validateRequired } from '../utils/common.js';

const router = express.Router();

const handleError = (res: express.Response, error: any, message: string) => {
  console.error(message, error);
  res.status(500).json({ error: 'Internal server error' });
};

// GET /api/tasks
router.get('/', (_req, res) => {
  try {
    const tasks = taskQueries.getAllTasks.all();
    res.json(tasks);
  } catch (error) {
    handleError(res, error, 'Error fetching tasks:');
  }
});

// GET /api/tasks/:id
router.get('/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = taskQueries.getTaskById.get(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const commits = commitQueries.getCommitsByTaskId.all(taskId);
    res.json({ ...task, commits });
  } catch (error) {
    handleError(res, error, 'Error fetching task:');
  }
});

// POST /api/tasks
router.post('/', (req, res) => {
  try {
    const { name, description, directory, branch_name } = req.body;
    
    const validation = validateRequired(req.body, ['name', 'branch_name', 'directory']);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = taskQueries.createTask.run(name, description || '', directory, branch_name, 'pending');
    const newTask = taskQueries.getTaskById.get(result.lastInsertRowid);
    res.status(201).json(newTask);
  } catch (error) {
    handleError(res, error, 'Error creating task:');
  }
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { name, description, directory, branch_name, status } = req.body;

    const existingTask = taskQueries.getTaskById.get(taskId) as any;
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    taskQueries.updateTask.run(
      name || existingTask.name,
      description || existingTask.description,
      directory || existingTask.directory,
      branch_name || existingTask.branch_name,
      status || existingTask.status,
      taskId
    );

    const updatedTask = taskQueries.getTaskById.get(taskId);
    res.json(updatedTask);
  } catch (error) {
    handleError(res, error, 'Error updating task:');
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    const existingTask = taskQueries.getTaskById.get(taskId);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    taskQueries.deleteTask.run(taskId);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    handleError(res, error, 'Error deleting task:');
  }
});

// POST /api/tasks/:id/commits
router.post('/:id/commits', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { commit_hash, commit_message } = req.body;

    if (!commit_hash) {
      return res.status(400).json({ error: 'Commit hash is required' });
    }

    const existingTask = taskQueries.getTaskById.get(taskId);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const existingCommit = commitQueries.checkCommitExists.get(commit_hash, taskId);
    if (existingCommit) {
      return res.status(409).json({ error: 'Commit already exists' });
    }

    commitQueries.createCommit.run(taskId, commit_hash, commit_message || '', 'pending');
    const commits = commitQueries.getCommitsByTaskId.all(taskId);
    res.status(201).json(commits);
  } catch (error) {
    handleError(res, error, 'Error adding commit:');
  }
});

// PUT /api/tasks/:id/commits/:commitId
router.put('/:id/commits/:commitId', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const commitId = parseInt(req.params.commitId);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    commitQueries.updateCommitStatus.run(status, commitId);
    const commits = commitQueries.getCommitsByTaskId.all(taskId);
    res.json(commits);
  } catch (error) {
    handleError(res, error, 'Error updating commit status:');
  }
});

// DELETE /api/tasks/:id/commits/:commitId
router.delete('/:id/commits/:commitId', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const commitId = parseInt(req.params.commitId);

    const existingTask = taskQueries.getTaskById.get(taskId);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const commits = commitQueries.getCommitsByTaskId.all(taskId);
    const commitExists = commits.find((c: any) => c.id === commitId);
    if (!commitExists) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    commitQueries.deleteCommit.run(commitId);
    const updatedCommits = commitQueries.getCommitsByTaskId.all(taskId);
    res.json(updatedCommits);
  } catch (error) {
    handleError(res, error, 'Error deleting commit:');
  }
});

export { router as taskRoutes };
