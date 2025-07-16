import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gitApi } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { GitBranch, RefreshCw, Calendar, Hash } from 'lucide-react';

export const BranchManager: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: gitApi.getBranches,
  });

  const refreshMutation = useMutation({
    mutationFn: gitApi.refreshGitData,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  if (branchesLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Loading branches...</div>
        </CardContent>
      </Card>
    );
  }

  const localBranches = branchesData?.branches.filter(branch => !branch.is_remote) || [];
  const remoteBranches = branchesData?.branches.filter(branch => branch.is_remote) || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <GitBranch className="h-5 w-5" />
                <span>Branch Manager</span>
              </CardTitle>
              <CardDescription>
                Manage and view all local and remote branches
              </CardDescription>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Local Branches */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <GitBranch className="h-4 w-4" />
                <span>Local Branches ({localBranches.length})</span>
              </h3>
              <div className="space-y-2">
                {localBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{branch.name}</div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                        <Hash className="h-3 w-3" />
                        <span className="font-mono">{branch.last_commit.substring(0, 7)}</span>
                        <Calendar className="h-3 w-3 ml-2" />
                        <span>{new Date(branch.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {localBranches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No local branches found
                  </div>
                )}
              </div>
            </div>

            {/* Remote Branches */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <GitBranch className="h-4 w-4" />
                <span>Remote Branches ({remoteBranches.length})</span>
              </h3>
              <div className="space-y-2">
                {remoteBranches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-3 rounded-md border hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{branch.name}</div>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                        <Hash className="h-3 w-3" />
                        <span className="font-mono">{branch.last_commit.substring(0, 7)}</span>
                        <Calendar className="h-3 w-3 ml-2" />
                        <span>{new Date(branch.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {remoteBranches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No remote branches found
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
