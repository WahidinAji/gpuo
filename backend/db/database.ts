import { Database } from 'bun:sqlite';
import { join } from 'path';

const dbPath = process.env.DB_PATH || join(process.cwd(), 'gpuo.db');
console.log(`Using database at: ${dbPath}`);
const db = new Database(dbPath);

db.exec('PRAGMA foreign_keys = ON');

export function initDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      directory TEXT NOT NULL,
      branch_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS commits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      commit_hash TEXT NOT NULL,
      commit_message TEXT,
      commit_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
    )
  `);

  // Add commit_date column if it doesn't exist
  try {
    db.exec(`ALTER TABLE commits ADD COLUMN commit_date TEXT`);
  } catch (error: any) {
    if (!error.message.includes('duplicate column name')) {
      console.error('Error adding commit_date column:', error.message);
    }
  }

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_repositories_active ON repositories(is_active)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_directory ON tasks(directory)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_commits_task_id ON commits(task_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_commits_status ON commits(status)`);
}

initDatabase();

export const commitQueries = {
  getCommitsByTaskId: db.prepare(`
    SELECT * FROM commits 
    WHERE task_id = ? 
    ORDER BY created_at DESC
  `),

  createCommit: db.prepare(`
    INSERT INTO commits (task_id, commit_hash, commit_message, status)
    VALUES (?, ?, ?, ?)
  `),

  updateCommitStatus: db.prepare(`
    UPDATE commits 
    SET status = ?
    WHERE id = ?
  `),

  updateCommitDetails: db.prepare(`
    UPDATE commits 
    SET commit_message = ?, commit_date = ?, status = ?
    WHERE id = ?
  `),

  deleteCommit: db.prepare(`DELETE FROM commits WHERE id = ?`),

  getCommitByHash: db.prepare(`
    SELECT * FROM commits WHERE commit_hash = ?
  `),

  checkCommitExists: db.prepare(`
    SELECT * FROM commits WHERE commit_hash = ? AND task_id = ?
  `),
};

export const repositoryQueries = {
  getAllRepositories: db.prepare(`
    SELECT * FROM repositories ORDER BY created_at DESC
  `),

  getActiveRepository: db.prepare(`
    SELECT * FROM repositories WHERE is_active = 1 LIMIT 1
  `),

  getRepositoryById: db.prepare(`
    SELECT * FROM repositories WHERE id = ?
  `),

  createRepository: db.prepare(`
    INSERT INTO repositories (name, path, is_active)
    VALUES (?, ?, ?)
  `),

  setActiveRepository: db.prepare(`
    UPDATE repositories SET is_active = 0
  `),

  setRepositoryActive: db.prepare(`
    UPDATE repositories SET is_active = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),

  deleteRepository: db.prepare(`DELETE FROM repositories WHERE id = ?`),
};

export const taskQueries = {
  getAllTasks: db.prepare(`
    SELECT 
      t.*,
      COUNT(c.id) as commit_count,
      COUNT(CASE WHEN c.status = 'pushed' THEN 1 END) as completed_commits
    FROM tasks t
    LEFT JOIN commits c ON t.id = c.task_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `),

  getTaskById: db.prepare(`
    SELECT * FROM tasks WHERE id = ?
  `),

  createTask: db.prepare(`
    INSERT INTO tasks (name, description, directory, branch_name, status)
    VALUES (?, ?, ?, ?, ?)
  `),

  updateTask: db.prepare(`
    UPDATE tasks 
    SET name = ?, description = ?, directory = ?, branch_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),

  deleteTask: db.prepare(`DELETE FROM tasks WHERE id = ?`),

  updateTaskStatus: db.prepare(`
    UPDATE tasks 
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
};

export default db;
