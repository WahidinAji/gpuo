import express from 'express';
import cors from 'cors';
import { setupDatabase } from './db/setup';
import { gitRoutes } from './routes/git';
import { branchRoutes } from './routes/branches';
import { historyRoutes } from './routes/history';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
setupDatabase();

// Routes
app.use('/api/git', gitRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 GPUO Server running on port ${PORT}`);
});
