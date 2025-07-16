import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, CheckCircle, Clock, AlertCircle, FolderOpen } from 'lucide-react'
import { api, Task } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function HomePage() {
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.getTasks
  })

  if (isLoading) return <div className="text-center py-8">Loading tasks...</div>
  if (error) return <div className="text-center py-8 text-destructive">Error loading tasks</div>

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-orange-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-orange-100 text-orange-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Tasks Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your cherry-pick tasks and track their progress
          </p>
        </div>
        <Link to="/create-task">
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Task</span>
          </Button>
        </Link>
      </div>

      {/* Tasks List */}
      {tasks?.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <div className="mx-auto h-12 w-12 text-muted-foreground">
              <AlertCircle className="h-full w-full" />
            </div>
            <h3 className="mt-2 text-sm font-medium">No tasks</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Get started by creating your first cherry-pick task.
            </p>
            <div className="mt-6">
              <Link to="/create-task">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks?.map((task: Task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{task.name}</CardTitle>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(task.status)}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Directory:</span>
                    <code className="px-2 py-1 bg-muted rounded text-xs max-w-[200px] truncate">
                      {task.directory}
                    </code>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Branch:</span>
                    <code className="px-2 py-1 bg-muted rounded text-xs">
                      {task.branch_name}
                    </code>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Commits:</span>
                    <span className="text-foreground">
                      {task.completed_commits || 0} / {task.commit_count || 0}
                    </span>
                  </div>
                  
                  <div className="pt-2">
                    <Link to={`/task/${task.id}`}>
                      <Button variant="outline" className="w-full">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
