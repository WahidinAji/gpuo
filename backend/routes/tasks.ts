import { taskQueries, commitQueries } from '../db/database';

export async function taskRoutes(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const method = request.method;

  try {
    // GET /api/tasks - Get all tasks
    if (method === 'GET' && pathParts.length === 2) {
      const tasks = taskQueries.getAllTasks.all();
      return new Response(JSON.stringify(tasks), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/tasks/:id - Get task by ID
    if (method === 'GET' && pathParts.length === 3) {
      const taskId = parseInt(pathParts[2]);
      const task = taskQueries.getTaskById.get(taskId);
      
      if (!task) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const commits = commitQueries.getCommitsByTaskId.all(taskId);
      
      return new Response(JSON.stringify({ ...task, commits }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/tasks - Create new task
    if (method === 'POST' && pathParts.length === 2) {
      const body = await request.json();
      const { name, description, branch_name } = body;

      if (!name || !branch_name) {
        return new Response(JSON.stringify({ error: 'Name and branch_name are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = taskQueries.createTask.run(name, description || '', branch_name, 'pending');
      const newTask = taskQueries.getTaskById.get(result.lastInsertRowid);

      return new Response(JSON.stringify(newTask), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /api/tasks/:id - Update task
    if (method === 'PUT' && pathParts.length === 3) {
      const taskId = parseInt(pathParts[2]);
      const body = await request.json();
      const { name, description, branch_name, status } = body;

      const existingTask = taskQueries.getTaskById.get(taskId);
      if (!existingTask) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      taskQueries.updateTask.run(
        name || existingTask.name,
        description || existingTask.description,
        branch_name || existingTask.branch_name,
        status || existingTask.status,
        taskId
      );

      const updatedTask = taskQueries.getTaskById.get(taskId);
      return new Response(JSON.stringify(updatedTask), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/tasks/:id - Delete task
    if (method === 'DELETE' && pathParts.length === 3) {
      const taskId = parseInt(pathParts[2]);
      
      const existingTask = taskQueries.getTaskById.get(taskId);
      if (!existingTask) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      taskQueries.deleteTask.run(taskId);
      return new Response(JSON.stringify({ message: 'Task deleted successfully' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/tasks/:id/commits - Add commit to task
    if (method === 'POST' && pathParts.length === 4 && pathParts[3] === 'commits') {
      const taskId = parseInt(pathParts[2]);
      const body = await request.json();
      const { commit_hash, commit_message } = body;

      if (!commit_hash) {
        return new Response(JSON.stringify({ error: 'Commit hash is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existingTask = taskQueries.getTaskById.get(taskId);
      if (!existingTask) {
        return new Response(JSON.stringify({ error: 'Task not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if commit already exists
      const existingCommit = commitQueries.getCommitByHash.get(commit_hash);
      if (existingCommit) {
        return new Response(JSON.stringify({ error: 'Commit already exists' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = commitQueries.createCommit.run(taskId, commit_hash, commit_message || '', 'pending');
      const commits = commitQueries.getCommitsByTaskId.all(taskId);

      return new Response(JSON.stringify(commits), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT /api/tasks/:id/commits/:commitId - Update commit status
    if (method === 'PUT' && pathParts.length === 5 && pathParts[3] === 'commits') {
      const taskId = parseInt(pathParts[2]);
      const commitId = parseInt(pathParts[4]);
      const body = await request.json();
      const { status } = body;

      if (!status) {
        return new Response(JSON.stringify({ error: 'Status is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      commitQueries.updateCommitStatus.run(status, commitId);
      const commits = commitQueries.getCommitsByTaskId.all(taskId);

      return new Response(JSON.stringify(commits), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (error) {
    console.error('Task routes error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
