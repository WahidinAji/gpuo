import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface GitCommit {
  hash: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

export interface GitAction {
  id: number;
  branch: string;
  commits: string;
  status: 'pending' | 'success' | 'error';
  timestamp: string;
  error_message?: string;
}

export interface Branch {
  id: number;
  name: string;
  is_remote: boolean;
  last_commit: string;
  timestamp: string;
}

export const gitApi = {
  getCurrentBranch: async (): Promise<{ branch: string }> => {
    const response = await api.get('/git/current-branch');
    return response.data;
  },

  getCommits: async (limit?: number): Promise<{ commits: GitCommit[] }> => {
    const response = await api.get('/git/commits', { params: { limit } });
    return response.data;
  },

  cherryPickAndPush: async (commits: string[], targetBranch: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/git/cherry-pick-push', { commits, targetBranch });
    return response.data;
  },

  refreshGitData: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/git/refresh');
    return response.data;
  },

  getBranches: async (): Promise<{ branches: Branch[] }> => {
    const response = await api.get('/branches');
    return response.data;
  },

  getHistory: async (): Promise<{ actions: GitAction[] }> => {
    const response = await api.get('/history');
    return response.data;
  },
};
