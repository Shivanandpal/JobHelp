import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { apiRouter } from './routes/api.routes.js';

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // Allow extension origins (chrome-extension://*) and localhost
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Job Auto-Apply & Recruiter Mail Tracker Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api', apiRouter);

// Start server
app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Backend running at http://localhost:${config.port}`);
  console.log(`📡 Ready to serve Chrome Extension & Webhooks`);
  console.log(`=======================================================`);
});

export default app;
