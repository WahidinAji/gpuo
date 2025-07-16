const API_BASE_URL = 'http://localhost:3001/api'

export interface Repository {
  id: number
  name: string
  path: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  name: string
  description: string
  directory: string
  branch_name: string
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  updated_at: string
  commit_count?: number
  completed_commits?: number
  commits?: Commit[]
}

export interface Commit {
  id: number
  task_id: number
  commit_hash: string
  commit_message: string
  commit_date?: string
  status: 'pending' | 'ready_to_push' | 'pushed'
  created_at: string
}

export interface GitCommit {
  hash: string
  message: string
}

// API functions
export const api = {
  // Repositories
  getRepositories: async (): Promise<Repository[]> => {
    const response = await fetch(`${API_BASE_URL}/repositories`)
    if (!response.ok) throw new Error('Failed to fetch repositories')
    return response.json()
  },

  getActiveRepository: async (): Promise<Repository | null> => {
    const response = await fetch(`${API_BASE_URL}/repositories/active`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to fetch active repository')
    }
    return response.json()
  },

  createRepository: async (repo: { name: string; path: string }): Promise<Repository> => {
    const response = await fetch(`${API_BASE_URL}/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(repo)
    })
    if (!response.ok) throw new Error('Failed to create repository')
    return response.json()
  },

  setActiveRepository: async (id: number): Promise<Repository> => {
    const response = await fetch(`${API_BASE_URL}/repositories/${id}/activate`, {
      method: 'POST'
    })
    if (!response.ok) throw new Error('Failed to set active repository')
    return response.json()
  },

  validateGitRepository: async (path: string): Promise<{ valid: boolean; error?: string }> => {
    const response = await fetch(`${API_BASE_URL}/repositories/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    })
    if (!response.ok) throw new Error('Failed to validate repository')
    return response.json()
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    const response = await fetch(`${API_BASE_URL}/tasks`)
    if (!response.ok) throw new Error('Failed to fetch tasks')
    return response.json()
  },

  getTask: async (id: number): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`)
    if (!response.ok) throw new Error('Failed to fetch task')
    return response.json()
  },

  createTask: async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    })
    if (!response.ok) throw new Error('Failed to create task')
    return response.json()
  },

  updateTask: async (id: number, task: Partial<Task>): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    })
    if (!response.ok) throw new Error('Failed to update task')
    return response.json()
  },

  deleteTask: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete task')
  },

  // Commits
  addCommitToTask: async (taskId: number, commit: { commit_hash: string; commit_message?: string }): Promise<Commit[]> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commit)
    })
    if (!response.ok) throw new Error('Failed to add commit')
    return response.json()
  },

  updateCommitStatus: async (taskId: number, commitId: number, status: string): Promise<Commit[]> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/commits/${commitId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    if (!response.ok) throw new Error('Failed to update commit status')
    return response.json()
  },

  deleteCommit: async (taskId: number, commitId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/commits/${commitId}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete commit')
  },

  // Git operations
  getGitCommits: async (directory: string): Promise<GitCommit[]> => {
    const response = await fetch(`${API_BASE_URL}/git/commits?directory=${encodeURIComponent(directory)}`)
    if (!response.ok) throw new Error('Failed to fetch git commits')
    const data = await response.json()
    return data.commits
  },

  cherryPickCommit: async (commitHash: string, branchName: string, directory: string, taskId?: number): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/git/cherry-pick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash, branchName, directory, taskId })
    })
    if (!response.ok) throw new Error('Failed to cherry-pick commit')
    return response.json()
  },

  pushBranch: async (branchName: string, directory: string, taskId?: number): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchName, directory, taskId })
    })
    if (!response.ok) throw new Error('Failed to push branch')
    return response.json()
  },

  getGitStatus: async (directory: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/git/status?directory=${encodeURIComponent(directory)}`)
    if (!response.ok) throw new Error('Failed to get git status')
    return response.json()
  },

  pushCommit: async (commitHash: string, branchName: string, directory: string, taskId: number, commitId: number): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/git/push-commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash, branchName, directory, taskId, commitId })
    })
    if (!response.ok) throw new Error('Failed to push commit')
    return response.json()
  },
}
