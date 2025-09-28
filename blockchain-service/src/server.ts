import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { 
  corsOptions, 
  helmetConfig, 
  requestLogger, 
  errorBoundary 
} from './middleware/security';
import { monitoringService } from './services/monitoring';
import { webhookRoutes } from './routes/webhook';
import { apiRoutes } from './routes/api';
import { healthRoutes } from './routes/health';
import adminRoutes from './routes/admin';
import { initializeDatabase } from './database/connection';
import { initializeRedis } from './services/redis';
import { startWorkers } from './workers';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmetConfig);
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api/', limiter);

// Body parsing
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Metrics endpoint
app.get('/metrics', (req, res) => {
  monitoringService.getMetrics(req, res);
});

// Error handling
app.use(errorHandler);
app.use(errorBoundary);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected successfully');

    // Start background workers
    await startWorkers();
    logger.info('Background workers started');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export { app };