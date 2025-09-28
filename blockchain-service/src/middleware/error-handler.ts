import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: AppError, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  // Set default error properties
  err.statusCode = err.statusCode || 500;
  err.isOperational = err.isOperational || false;

  // Log error
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Development error response (detailed)
  if (config.server.nodeEnv === 'development') {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Production error response (minimal)
  if (err.isOperational) {
    // Operational errors that are safe to expose
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Programming errors or unknown errors - don't leak details
  return res.status(500).json({
    error: {
      message: 'Internal server error',
      statusCode: 500,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Async error wrapper to catch async function errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create operational error
 */
export const createError = (message: string, statusCode: number): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  
  // Optionally exit the process
  if (config.server.nodeEnv === 'production') {
    process.exit(1);
  }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack
  });
  
  // Exit the process as the application is in an undefined state
  process.exit(1);
});