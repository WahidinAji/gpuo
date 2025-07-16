import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, CheckCircle, AlertCircle, Plus, GitBranch } from 'lucide-react'
import { api, Repository } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function RepositorySetupPage() {
  const queryClient = useQueryClient()
  const [newRepoPath, setNewRepoPath] = useState('')
  const [newRepoName, setNewRepoName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Fetch repositories
  const { data: repositories, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: api.getRepositories
  })

  // Fetch active repository
  const { data: activeRepository } = useQuery({
    queryKey: ['activeRepository'],
    queryFn: api.getActiveRepository
  })

  // Create repository mutation
  const createRepositoryMutation = useMutation({
    mutationFn: api.createRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
      setNewRepoPath('')
      setNewRepoName('')
      setErrors({})
    },
    onError: (error: any) => {
      setErrors({ general: error.message || 'Failed to create repository' })
    }
  })

  // Set active repository mutation
  const setActiveRepositoryMutation = useMutation({
    mutationFn: api.setActiveRepository,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeRepository'] })
    }
  })

  // Validate repository mutation
  const validateRepositoryMutation = useMutation({
    mutationFn: api.validateGitRepository,
    onSuccess: (data) => {
      if (data.valid) {
        setErrors({})
      } else {
        setErrors({ path: data.error || 'Invalid git repository' })
      }
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!newRepoPath.trim()) {
      setErrors({ path: 'Repository path is required' })
      return
    }

    if (!newRepoName.trim()) {
      setErrors({ name: 'Repository name is required' })
      return
    }

    // Validate repository first
    const validation = await validateRepositoryMutation.mutateAsync(newRepoPath.trim())
    if (validation.valid) {
      createRepositoryMutation.mutate({
        name: newRepoName.trim(),
        path: newRepoPath.trim()
      })
    }
  }

  const handleSetActive = (repo: Repository) => {
    setActiveRepositoryMutation.mutate(repo.id)
  }

  const handleBrowseFolder = async () => {
    try {
      // Check if File System Access API is supported
      if ('showDirectoryPicker' in window) {
        // Use the modern File System Access API
        const directoryHandle = await (window as any).showDirectoryPicker()
        if (directoryHandle) {
          // Get the full path if available, otherwise use the directory name
          const path = directoryHandle.name
          setNewRepoPath(path)
          
          // If name is empty, use directory name as default
          if (!newRepoName.trim()) {
            setNewRepoName(directoryHandle.name)
          }
        }
      } else {
        // Fallback: Create a hidden file input for directory selection
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true
        input.multiple = true
        
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files
          if (files && files.length > 0) {
            // Get the directory path from the first file
            const firstFile = files[0]
            const pathParts = firstFile.webkitRelativePath.split('/')
            const directoryName = pathParts[0]
            
            // For security reasons, we can't get the full system path
            // So we'll use the directory name and let the user adjust if needed
            setNewRepoPath(directoryName)
            
            // If name is empty, use directory name as default
            if (!newRepoName.trim()) {
              setNewRepoName(directoryName)
            }
          }
        }
        
        input.click()
      }
    } catch (error) {
      console.error('Error selecting directory:', error)
      // Show a more user-friendly message
      alert('Unable to open directory picker. Please enter the path manually.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Repository Setup</h1>
        <p className="text-muted-foreground">
          Configure git repositories for GPUO to manage your cherry-pick operations
        </p>
      </div>

      {/* Active Repository */}
      {activeRepository && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span>Active Repository</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-green-600" />
                <span className="font-medium">{activeRepository.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {activeRepository.path}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Repository */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add New Repository</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="repo-name" className="text-sm font-medium">
                Repository Name
              </label>
              <Input
                id="repo-name"
                placeholder="e.g., My Project"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="repo-path" className="text-sm font-medium">
                Repository Path
              </label>
              <div className="flex space-x-2">
                <Input
                  id="repo-path"
                  placeholder="/path/to/your/git/repository"
                  value={newRepoPath}
                  onChange={(e) => setNewRepoPath(e.target.value)}
                  className={errors.path ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFolder}
                  className="flex items-center space-x-2"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>Browse</span>
                </Button>
              </div>
              {errors.path && (
                <p className="text-sm text-destructive">{errors.path}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the full path to your git repository. Use the Browse button to select a directory.
              </p>
            </div>

            {errors.general && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{errors.general}</p>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={createRepositoryMutation.isPending || validateRepositoryMutation.isPending}
              className="w-full"
            >
              {createRepositoryMutation.isPending ? 'Adding Repository...' : 'Add Repository'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Repositories */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Repositories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading repositories...</div>
          ) : repositories && repositories.length > 0 ? (
            <div className="space-y-3">
              {repositories.map((repo) => (
                <div 
                  key={repo.id} 
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    repo.is_active ? 'border-green-200 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <GitBranch className={`h-4 w-4 ${repo.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    <div>
                      <div className="font-medium">{repo.name}</div>
                      <div className="text-sm text-muted-foreground">{repo.path}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {repo.is_active ? (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(repo)}
                        disabled={setActiveRepositoryMutation.isPending}
                      >
                        Set Active
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No repositories configured</p>
              <p className="text-sm">Add a git repository to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
