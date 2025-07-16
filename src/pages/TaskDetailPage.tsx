import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, GitBranch, CheckCircle, Clock, Hash, Play, Trash2, AlertCircle } from 'lucide-react'
import { api, GitCommit } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const taskId = parseInt(id || '0')
  
  const [isAddingCommit, setIsAddingCommit] = useState(false)
  const [commitHash, setCommitHash] = useState('')
  const [showGitCommits, setShowGitCommits] = useState(false)

  // Fetch task details
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.getTask(taskId),
    enabled: !!taskId
  })

  // Fetch git commits
  const { data: gitCommits } = useQuery({
    queryKey: ['gitCommits', task?.directory],
    queryFn: () => api.getGitCommits(task?.directory || ''),
    enabled: showGitCommits && !!task?.directory
  })

  // Add commit mutation
  const addCommitMutation = useMutation({
    mutationFn: (commitData: { commit_hash: string; commit_message?: string }) =>
      api.addCommitToTask(taskId, commitData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      setCommitHash('')
      setIsAddingCommit(false)
      setShowGitCommits(false)
    }
  })

  // Cherry-pick mutation
  const cherryPickMutation = useMutation({
    mutationFn: (commitHash: string) => 
      api.cherryPickCommit(commitHash, task?.branch_name || '', task?.directory || '', taskId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      
      // Show conflict message if there's a conflict
      if (data.hasConflict) {
        alert(data.conflictMessage || 'There are conflicts, please fix them before pushing')
      }
    }
  })

  // Push commit mutation
  const pushCommitMutation = useMutation({
    mutationFn: ({ commitHash, commitId }: { commitHash: string; commitId: number }) => 
      api.pushCommit(commitHash, task?.branch_name || '', task?.directory || '', taskId, commitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    }
  })

  // Delete commit mutation
  const deleteCommitMutation = useMutation({
    mutationFn: (commitId: number) => 
      api.deleteCommit(taskId, commitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
    }
  })

  // Conflict status check mutation
  const conflictStatusMutation = useMutation({
    mutationFn: () => api.getConflictStatus(task?.directory || ''),
    onSuccess: (data) => {
      if (data.cherryPickInProgress) {
        if (data.allConflictsFixed) {
          // Show success message when all conflicts are resolved
          const message = `✅ All conflicts have been resolved!\n\n` +
            `Current status: ${data.statusMessage}\n` +
            `Cherry-picking commit: ${data.currentCommit}\n\n` +
            `Next steps:\n` +
            `1. Click "Continue" to complete the cherry-pick operation\n` +
            `2. Return to the app to push the commit\n\n` +
            `The git status shows: "all conflicts fixed: run 'git cherry-pick --continue'"`;
          
          if (window.confirm(message + '\n\nWould you like to continue the cherry-pick now?')) {
            const commit = task?.commits?.find(c => c.status === 'conflict');
            if (commit) {
              handleContinueCherryPick(commit.id);
            }
          }
        } else if (data.needsResolution) {
          // Show detailed conflict information
          let message = `⚠️ Cherry-pick conflicts detected!\n\n` +
            `Status: ${data.statusMessage}\n` +
            `Branch: ${data.currentBranch || 'Unknown'}\n` +
            `Cherry-picking commit: ${data.currentCommit}\n\n`;
          
          if (data.conflictedFiles.length > 0) {
            message += `Files with conflicts (${data.conflictedFiles.length}):\n`;
            data.conflictedFiles.forEach((file: string) => {
              message += `  • ${file}\n`;
            });
            message += `\n`;
          }
          
          message += `Next steps:\n` +
            `1. Open your code editor and resolve the conflicts in the files listed above\n` +
            `2. Look for conflict markers like <<<<<<< HEAD, =======, and >>>>>>>\n` +
            `3. Edit the files to choose the correct code\n` +
            `4. Save the files after resolving conflicts\n` +
            `5. Use "git add <file>" to mark resolved files as staged\n` +
            `6. Return to this app and click "Continue" to complete the cherry-pick\n\n` +
            `Or click "Abort" to cancel the cherry-pick operation.\n\n` +
            `Raw git status:\n${data.rawStatusOutput}`;
          
          alert(message);
        } else {
          // Generic in-progress message
          const message = `🔄 Cherry-pick operation in progress\n\n` +
            `Status: ${data.statusMessage}\n` +
            `Details: ${data.detailedMessage}\n\n` +
            `Action needed: ${data.userAction}\n\n` +
            `Raw git status:\n${data.rawStatusOutput}`;
          
          alert(message);
        }
      } else {
        alert('ℹ️ No cherry-pick operation in progress.\n\nYou can safely proceed with other operations.');
      }
    },
    onError: (error) => {
      alert(`❌ Error checking conflict status: ${error.message}`);
    }
  })

  // Cherry-pick abort mutation
  const cherryPickAbortMutation = useMutation({
    mutationFn: ({ commitId }: { commitId: number }) => 
      api.cherryPickAbort(task?.directory || '', taskId, commitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      alert('Cherry-pick operation has been aborted successfully.')
    },
    onError: (error) => {
      alert(`Error aborting cherry-pick: ${error.message}`)
    }
  })

  // Cherry-pick continue mutation
  const cherryPickContinueMutation = useMutation({
    mutationFn: ({ commitId }: { commitId: number }) => 
      api.cherryPickContinue(task?.directory || '', taskId, commitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      alert('Cherry-pick operation completed successfully! You can now push the commit.')
    },
    onError: (error) => {
      alert(`Error continuing cherry-pick: ${error.message}`)
    }
  })

  const handleAddCommit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commitHash.trim()) return

    const gitCommit = gitCommits?.find(c => c.hash.startsWith(commitHash))
    
    addCommitMutation.mutate({
      commit_hash: commitHash.trim(),
      commit_message: gitCommit?.message || ''
    })
  }

  const handleAddFromGit = (gitCommit: GitCommit) => {
    addCommitMutation.mutate({
      commit_hash: gitCommit.hash,
      commit_message: gitCommit.message
    })
  }

  const handleCherryPick = (commitHash: string) => {
    cherryPickMutation.mutate(commitHash)
  }

  const handlePushCommit = (commitHash: string, commitId: number) => {
    pushCommitMutation.mutate({ commitHash, commitId })
  }

  const handleDeleteCommit = (commitId: number) => {
    if (window.confirm('Are you sure you want to delete this commit?')) {
      deleteCommitMutation.mutate(commitId)
    }
  }

  const handleCheckConflictStatus = () => {
    conflictStatusMutation.mutate()
  }

  const handleAbortCherryPick = (commitId: number) => {
    if (window.confirm('Are you sure you want to abort the cherry-pick operation?\n\nThis will discard all changes and return to the original state.')) {
      cherryPickAbortMutation.mutate({ commitId })
    }
  }

  const handleContinueCherryPick = (commitId: number) => {
    if (window.confirm('Continue cherry-pick operation?\n\nMake sure you have resolved all conflicts and staged the changes (git add).')) {
      cherryPickContinueMutation.mutate({ commitId })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pushed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'ready_to_push':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'conflict':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-orange-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pushed':
        return 'bg-green-100 text-green-800'
      case 'ready_to_push':
        return 'bg-blue-100 text-blue-800'
      case 'conflict':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-orange-100 text-orange-800'
    }
  }

  if (isLoading) return <div className="text-center py-8">Loading task...</div>
  if (error) return <div className="text-center py-8 text-destructive">Error loading task</div>
  if (!task) return <div className="text-center py-8">Task not found</div>

  const completedCommits = task.commits?.filter(c => c.status === 'pushed').length || 0
  const totalCommits = task.commits?.length || 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{task.name}</h1>
          <p className="text-muted-foreground">{task.description}</p>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusIcon(task.status)}
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Task Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {task.branch_name}
              </code>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Commits</span>
                <span>{completedCommits} / {totalCommits}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: totalCommits > 0 ? `${(completedCommits / totalCommits) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-2">
              Push commits individually when ready
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commits Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Commits</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGitCommits(!showGitCommits)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Browse Git Commits
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingCommit(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Commit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add Commit Form */}
          {isAddingCommit && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <form onSubmit={handleAddCommit} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Enter commit hash"
                    value={commitHash}
                    onChange={(e) => setCommitHash(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" size="sm" disabled={addCommitMutation.isPending}>
                    {addCommitMutation.isPending ? 'Adding...' : 'Add'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsAddingCommit(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Git Commits Browser */}
          {showGitCommits && (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-3">Recent Git Commits</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {gitCommits?.map((commit) => (
                  <div key={commit.hash} className="flex items-center justify-between p-2 hover:bg-background rounded">
                    <div className="flex items-center space-x-3 flex-1">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {commit.hash.substring(0, 7)}
                      </code>
                      <span className="text-sm truncate">{commit.message}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddFromGit(commit)}
                      disabled={task.commits?.some(c => c.commit_hash === commit.hash)}
                    >
                      {task.commits?.some(c => c.commit_hash === commit.hash) ? 'Added' : 'Add'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commits List */}
          {task.commits && task.commits.length > 0 ? (
            <div className="space-y-3">
              {task.commits.map((commit) => (
                <div 
                  key={commit.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(commit.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {commit.commit_hash.substring(0, 7)}
                        </code>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(commit.status)}`}>
                          {commit.status}
                        </span>
                      </div>
                      {commit.commit_message && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {commit.commit_message}
                        </p>
                      )}
                      {commit.commit_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {commit.commit_date}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {commit.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => handleCherryPick(commit.commit_hash)}
                        disabled={cherryPickMutation.isPending}
                        className="flex items-center space-x-1"
                      >
                        <Play className="h-3 w-3" />
                        <span>Cherry-pick</span>
                      </Button>
                    )}
                    {commit.status === 'ready_to_push' && (
                      <Button
                        size="sm"
                        onClick={() => handlePushCommit(commit.commit_hash, commit.id)}
                        disabled={pushCommitMutation.isPending}
                        className="flex items-center space-x-1"
                        variant="default"
                      >
                        <GitBranch className="h-3 w-3" />
                        <span>Push</span>
                      </Button>
                    )}
                    {commit.status === 'pushed' && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span className="text-sm">Pushed</span>
                      </div>
                    )}
                    {commit.status === 'conflict' && (
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-sm">Conflict - Needs Resolution</span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleCheckConflictStatus()}
                          disabled={conflictStatusMutation.isPending}
                          className="flex items-center space-x-1"
                          variant="outline"
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>Check Status</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAbortCherryPick(commit.id)}
                          disabled={cherryPickAbortMutation.isPending}
                          className="flex items-center space-x-1"
                          variant="destructive"
                        >
                          <span>Abort</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleContinueCherryPick(commit.id)}
                          disabled={cherryPickContinueMutation.isPending}
                          className="flex items-center space-x-1"
                          variant="default"
                        >
                          <span>Continue</span>
                        </Button>
                      </div>
                    )}
                    
                    {/* Show delete button for pending, ready_to_push, and conflict commits */}
                    {(commit.status === 'pending' || commit.status === 'ready_to_push' || commit.status === 'conflict') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteCommit(commit.id)}
                        disabled={deleteCommitMutation.isPending}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Hash className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No commits added yet</p>
              <p className="text-sm">Add commits to start cherry-picking</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
