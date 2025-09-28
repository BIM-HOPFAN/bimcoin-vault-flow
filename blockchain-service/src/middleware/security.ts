import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Security middleware configuration
 */

// Rate limiting
export const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });
      res.status(429).json({ error: message });
    }
  });
};

// General API rate limiting
export const apiRateLimit = createRateLimit(
  config.security.rateLimitWindowMs,
  config.security.rateLimitMax,
  'Too many requests, please try again later'
);

// Strict rate limiting for sensitive operations
export const withdrawalRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  5, // 5 requests per minute
  'Too many withdrawal requests, please try again later'
);

// Webhook rate limiting
export const webhookRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  100, // 100 webhooks per minute
  'Too many webhook requests'
);

// CORS configuration
export const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://your-frontend-domain.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Helmet security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://toncenter.com", "https://tonapi.io"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
});

/**
 * Webhook signature verification middleware
 */
export const verifyWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    
    if (!signature || !timestamp) {
      logger.warn('Missing webhook signature or timestamp', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const now = Math.floor(Date.now() / 1000);
    const webhookTime = parseInt(timestamp);
    if (Math.abs(now - webhookTime) > 300) {
      logger.warn('Webhook timestamp too old', {
        now,
        webhookTime,
        difference: Math.abs(now - webhookTime)
      });
      return res.status(401).json({ error: 'Webhook timestamp too old' });
    }

    // Verify HMAC signature
    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.security.webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      logger.warn('Invalid webhook signature', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    next();
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    res.status(500).json({ error: 'Signature verification failed' });
  }
};

/**
 * Input validation middleware
 */
export const validateInput = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error, value } = schema.validate(req.body);
      if (error) {
        logger.warn('Input validation failed', {
          error: error.details[0].message,
          path: req.path,
          ip: req.ip
        });
        return res.status(400).json({
          error: 'Validation failed',
          details: error.details[0].message
        });
      }
      req.body = value;
      next();
    } catch (error) {
      logger.error('Input validation error:', error);
      res.status(500).json({ error: 'Validation error' });
    }
  };
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

/**
 * Error boundary middleware
 */
export const errorBoundary = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Don't leak error details in production
  const message = config.server.nodeEnv === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(500).json({ error: message });
};