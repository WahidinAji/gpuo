import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gitApi } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { History, CheckCircle, XCircle, Clock, GitBranch } from 'lucide-react';

export const ActionHistory: React.FC = () => {
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['history'],
    queryFn: gitApi.getHistory,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'pending':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  if (historyLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Loading action history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Action History</span>
          </CardTitle>
          <CardDescription>
            View all cherry-pick and push operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {historyData?.actions.map((action) => (
              <div
                key={action.id}
                className={`p-4 rounded-lg border transition-colors ${getStatusColor(action.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(action.status)}
                      <span className="font-medium capitalize">{action.status}</span>
                      <span className="text-muted-foreground">•</span>
                      <div className="flex items-center space-x-1">
                        <GitBranch className="h-3 w-3" />
                        <span className="text-sm font-mono">{action.branch}</span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Commits: {action.commits.split(',').map(commit => (
                        <span key={commit} className="inline-block bg-muted px-2 py-1 rounded mr-1 font-mono">
                          {commit.substring(0, 7)}
                        </span>
                      ))}
                    </div>
                    {action.error_message && (
                      <div className="text-sm text-red-600 bg-red-100 p-2 rounded">
                        Error: {action.error_message}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    {new Date(action.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {(!historyData?.actions || historyData.actions.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No action history found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
