import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi, GitCommit } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { GitCommit as GitCommitIcon, GitBranch, CheckCircle, AlertCircle } from 'lucide-react';

export const GitCommitPicker: React.FC = () => {
  const [selectedCommits, setSelectedCommits] = useState<string[]>([]);
  const [targetBranch, setTargetBranch] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: commitsData, isLoading: commitsLoading } = useQuery({
    queryKey: ['commits'],
    queryFn: () => gitApi.getCommits(50),
  });

  const { data: currentBranchData } = useQuery({
    queryKey: ['current-branch'],
    queryFn: gitApi.getCurrentBranch,
  });

  const cherryPickMutation = useMutation({
    mutationFn: ({ commits, branch }: { commits: string[]; branch: string }) =>
      gitApi.cherryPickAndPush(commits, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
      setSelectedCommits([]);
      setTargetBranch('');
    },
  });

  const handleCommitToggle = (commitHash: string) => {
    setSelectedCommits(prev =>
      prev.includes(commitHash)
        ? prev.filter(hash => hash !== commitHash)
        : [...prev, commitHash]
    );
  };

  const handleCherryPick = () => {
    if (selectedCommits.length > 0 && targetBranch) {
      cherryPickMutation.mutate({ commits: selectedCommits, branch: targetBranch });
    }
  };

  if (commitsLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Loading commits...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitBranch className="h-5 w-5" />
            <span>Cherry Pick Commits</span>
          </CardTitle>
          <CardDescription>
            Select commits to cherry-pick and specify the target branch
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Target Branch</label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="feature/my-new-branch"
                className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            
            {selectedCommits.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <span className="text-sm">
                  {selectedCommits.length} commit(s) selected
                </span>
                <Button
                  onClick={handleCherryPick}
                  disabled={!targetBranch || cherryPickMutation.isPending}
                  className="ml-4"
                >
                  {cherryPickMutation.isPending ? 'Processing...' : 'Cherry Pick & Push'}
                </Button>
              </div>
            )}

            {cherryPickMutation.isError && (
              <div className="flex items-center space-x-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Error: {cherryPickMutation.error?.message}</span>
              </div>
            )}

            {cherryPickMutation.isSuccess && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Successfully cherry-picked and pushed!</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GitCommitIcon className="h-5 w-5" />
            <span>Recent Commits</span>
          </CardTitle>
          <CardDescription>
            From branch: {currentBranchData?.branch || 'unknown'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {commitsData?.commits.map((commit: GitCommit) => (
              <div
                key={commit.hash}
                className={`flex items-center space-x-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  selectedCommits.includes(commit.hash)
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted'
                }`}
                onClick={() => handleCommitToggle(commit.hash)}
              >
                <input
                  type="checkbox"
                  checked={selectedCommits.includes(commit.hash)}
                  onChange={() => handleCommitToggle(commit.hash)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {commit.hash.substring(0, 7)}
                    </span>
                    <span className="text-sm font-medium truncate">
                      {commit.message}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {commit.author_name} • {new Date(commit.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
