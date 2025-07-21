# GPUO - Git Push-U-Origin

A web application that automates git cherry-pick and push operations for managing commits across multiple branches.

## Features

- **Task Management**: Create and manage cherry-pick tasks
- **Git Integration**: Browse commits, cherry-pick to target branches
- **Progress Tracking**: Visual progress indicators and status updates
- **Branch Management**: Automatic branch creation and pushing
- **Real-time Updates**: Live status updates during operations

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: SQLite
- **Build Tool**: Vite
- **Package Manager**: Bun

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Start development servers**:
   ```bash
   # Frontend (http://localhost:3000)
   bun run dev:frontend
   
   # Backend (http://localhost:3001)
   bun run dev:backend
   ```

3. **Or start both simultaneously**:
   ```bash
   npm run dev
   ```

## Usage

1. **Create a Task**: Click "Create Task" and provide a name and branch name
2. **Add Commits**: In the task detail page, add commits by hash or browse recent commits
3. **Cherry-pick**: Click "Cherry-pick" next to each commit to apply it to your branch
4. **Push Branch**: Once commits are cherry-picked, push the branch to origin

## Development

The application consists of:
- **Frontend**: React app with routing and state management
- **Backend**: Express API with SQLite database
- **Database**: Automatic initialization with tasks and commits tables

## License

MIT
