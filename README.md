# GPUO - Git Push -u Origin

A modern web application that automates the process of cherry-picking commits and pushing them to new branches.

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) runtime installed
- Git repository initialized

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   cd client && bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Open your browser to `http://localhost:3000`

## Features

- **Cherry-Pick Automation**: Select multiple commits and push them to a new branch
- **Branch Management**: View and manage local and remote branches
- **Action History**: Track all cherry-pick operations with detailed status
- **Modern UI**: Clean, responsive interface built with React and Tailwind CSS

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, TanStack Query
- **Backend**: Express.js, TypeScript, SQLite
- **Runtime**: Bun
- **UI Components**: Radix UI, shadcn/ui

## Usage

1. **Cherry Pick**: Select commits from the list and specify a target branch
2. **Branches**: View all local and remote branches with their details
3. **History**: Review all past cherry-pick operations and their status

## Development

- `bun run dev` - Start both server and client
- `bun run dev:server` - Start server only (port 3001)
- `bun run dev:client` - Start client only (port 3000)
- `bun run build` - Build for production

## Documentation

See [SUMMARY.md](SUMMARY.md) for detailed implementation documentation.

## License

MIT
