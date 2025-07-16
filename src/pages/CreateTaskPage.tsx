import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function CreateTaskPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    directory: '',
    branch_name: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createTaskMutation = useMutation({
    mutationFn: api.createTask,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      navigate(`/task/${data.id}`)
    },
    onError: (error) => {
      console.error('Failed to create task:', error)
      setErrors({ general: 'Failed to create task. Please try again.' })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validation
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Task name is required'
    }
    if (!formData.directory.trim()) {
      newErrors.directory = 'Directory is required'
    }
    if (!formData.branch_name.trim()) {
      newErrors.branch_name = 'Branch name is required'
    }
    if (!/^[a-zA-Z0-9_\/-]+$/.test(formData.branch_name)) {
      newErrors.branch_name = 'Branch name contains invalid characters'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    createTaskMutation.mutate({
      name: formData.name.trim(),
      description: formData.description.trim(),
      directory: formData.directory.trim(),
      branch_name: formData.branch_name.trim(),
      status: 'pending'
    })
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
        <div>
          <h1 className="text-3xl font-bold">Create New Task</h1>
          <p className="text-muted-foreground">
            Create a new cherry-pick task to organize your commits
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Task Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Task Name *
              </label>
              <Input
                id="name"
                placeholder="Enter task name (e.g., 'Feature Authentication')"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                placeholder="Enter task description (optional)"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>

            {/* Directory */}
            <div className="space-y-2">
              <label htmlFor="directory" className="text-sm font-medium">
                Directory *
              </label>
              <Input
                id="directory"
                placeholder="Enter git repository directory (e.g., '/path/to/your/repo')"
                value={formData.directory}
                onChange={(e) => handleInputChange('directory', e.target.value)}
                className={errors.directory ? 'border-destructive' : ''}
              />
              {errors.directory && (
                <p className="text-sm text-destructive">{errors.directory}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Full path to the git repository where cherry-pick operations will be performed
              </p>
            </div>

            {/* Branch Name */}
            <div className="space-y-2">
              <label htmlFor="branch_name" className="text-sm font-medium">
                Branch Name *
              </label>
              <Input
                id="branch_name"
                placeholder="Enter branch name (e.g., 'feature/auth')"
                value={formData.branch_name}
                onChange={(e) => handleInputChange('branch_name', e.target.value)}
                className={errors.branch_name ? 'border-destructive' : ''}
              />
              {errors.branch_name && (
                <p className="text-sm text-destructive">{errors.branch_name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This branch will be created when you cherry-pick commits
              </p>
            </div>

            {/* General Error */}
            {errors.general && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{errors.general}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                disabled={createTaskMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
