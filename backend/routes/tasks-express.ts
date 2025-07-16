import express from 'express';
import { taskQueries, commitQueries } from '../db/database';

interface Task {
  id: number;
  name: string;
  description: string;
  directory: string;
  branch_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const router = express.Router();

// GET /api/tasks - Get all tasks
router.get('/', (_req, res) => {
  try {
    const tasks = taskQueries.getAllTasks.all();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tasks/:id - Get task by ID
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
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks - Create new task
router.post('/', (req, res) => {
  try {
    const { name, description, directory, branch_name } = req.body;

    if (!name || !branch_name || !directory) {
      return res.status(400).json({ error: 'Name, branch_name, and directory are required' });
    }

    const result = taskQueries.createTask.run(name, description || '', directory, branch_name, 'pending');
    const newTask = taskQueries.getTaskById.get(result.lastInsertRowid);

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { name, description, directory, branch_name, status } = req.body;

    const existingTask = taskQueries.getTaskById.get(taskId) as Task | undefined;
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
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id - Delete task
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
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks/:id/commits - Add commit to task
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

    // Check if commit already exists
    const existingCommit = commitQueries.checkCommitExists.get(commit_hash, taskId);
    if (existingCommit) {
      return res.status(409).json({ error: 'Commit already exists' });
    }

    commitQueries.createCommit.run(taskId, commit_hash, commit_message || '', 'pending');
    const commits = commitQueries.getCommitsByTaskId.all(taskId);

    res.status(201).json(commits);
  } catch (error) {
    console.error('Error adding commit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id/commits/:commitId - Update commit status
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
    console.error('Error updating commit status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id/commits/:commitId - Delete commit from task
router.delete('/:id/commits/:commitId', (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const commitId = parseInt(req.params.commitId);

    const existingTask = taskQueries.getTaskById.get(taskId);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if commit exists
    const commits = commitQueries.getCommitsByTaskId.all(taskId);
    const commitExists = commits.find((c: any) => c.id === commitId);
    if (!commitExists) {
      return res.status(404).json({ error: 'Commit not found' });
    }

    commitQueries.deleteCommit.run(commitId);
    const updatedCommits = commitQueries.getCommitsByTaskId.all(taskId);

    res.json(updatedCommits);
  } catch (error) {
    console.error('Error deleting commit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as taskRoutes };
