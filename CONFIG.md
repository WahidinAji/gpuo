# GPUO Configuration

## Environment Variables
# You can create a .env file in the root directory with these variables:

# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_PATH=./gpuo.db

# Client Configuration (if needed)
VITE_API_URL=http://localhost:3001

## Notes
- The database file (gpuo.db) is automatically created when the server starts
- The client runs on port 3000 and proxies API requests to the server on port 3001
- Hot reloading is enabled for both client and server in development mode
