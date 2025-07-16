import { serve } from 'bun';
import { initDatabase } from './db/database';
import { taskRoutes } from './routes/tasks';
import { gitRoutes } from './routes/git';

// Initialize database
initDatabase();

const server = serve({
  port: 3001,
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Add CORS headers to all responses
    const addCorsHeaders = (response: Response) => {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    };

    try {
      // Route handling
      if (url.pathname.startsWith('/api/tasks')) {
        const response = await taskRoutes(request);
        return addCorsHeaders(response);
      }
      
      if (url.pathname.startsWith('/api/git')) {
        const response = await gitRoutes(request);
        return addCorsHeaders(response);
      }

      // Health check
      if (url.pathname === '/api/health') {
        return addCorsHeaders(new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      // 404 for unknown routes
      return addCorsHeaders(new Response('Not Found', { status: 404 }));
    } catch (error) {
      console.error('Server error:', error);
      return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  },
});

console.log(`🚀 Server running on http://localhost:${server.port}`);
