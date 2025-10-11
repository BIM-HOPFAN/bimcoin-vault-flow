/**
 * Input validation schemas for task API using zod
 * Prevents XSS, SQL injection, and malformed data attacks
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

// Task creation/update schema
export const taskSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be less than 100 characters')
    .refine(
      (val) => !/<script|javascript:|onerror=/i.test(val),
      'Title contains forbidden content'
    ),
  
  description: z.string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters')
    .refine(
      (val) => !/<script|javascript:|onerror=/i.test(val),
      'Description contains forbidden content'
    ),
  
  task_type: z.string()
    .trim()
    .min(1, 'Task type is required')
    .max(50, 'Task type must be less than 50 characters'),
  
  reward_amount: z.number()
    .positive('Reward amount must be positive')
    .min(0.1, 'Minimum reward is 0.1')
    .max(10000, 'Maximum reward is 10,000')
    .finite('Reward amount must be finite'),
  
  external_url: z.string()
    .url('Invalid URL format')
    .max(500, 'URL must be less than 500 characters')
    .optional()
    .nullable(),
  
  verification_type: z.enum(['manual', 'url_visit', 'social_follow', 'deposit', 'time_based'])
    .optional()
    .default('manual'),
  
  verification_data: z.record(z.unknown())
    .optional()
    .default({}),
  
  daily_limit: z.number()
    .int('Daily limit must be an integer')
    .positive('Daily limit must be positive')
    .max(100, 'Maximum daily limit is 100')
    .optional()
    .default(1),
  
  completion_timeout: z.number()
    .int('Timeout must be an integer')
    .min(60, 'Minimum timeout is 60 seconds')
    .max(3600, 'Maximum timeout is 1 hour')
    .optional()
    .default(300),
  
  is_active: z.boolean()
    .optional()
    .default(true),
})

// Task update schema (all fields optional)
export const taskUpdateSchema = taskSchema.partial()

// Verification data schema for task completion
export const verificationDataSchema = z.object({
  url: z.string().url().optional(),
  timestamp: z.number().optional(),
  proof: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict()

// Sanitize HTML to prevent XSS
export function sanitizeHtml(html: string): string {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Validate and sanitize task data
export function validateTaskData(data: unknown) {
  try {
    const validated = taskSchema.parse(data)
    
    // Additional sanitization
    return {
      ...validated,
      title: sanitizeHtml(validated.title),
      description: sanitizeHtml(validated.description),
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      throw new Error(`Validation failed: ${messages.join(', ')}`)
    }
    throw error
  }
}

// Validate task update data
export function validateTaskUpdateData(data: unknown) {
  try {
    const validated = taskUpdateSchema.parse(data)
    
    // Additional sanitization for fields that exist
    const sanitized: any = { ...validated }
    if (sanitized.title) {
      sanitized.title = sanitizeHtml(sanitized.title)
    }
    if (sanitized.description) {
      sanitized.description = sanitizeHtml(sanitized.description)
    }
    
    return sanitized
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      throw new Error(`Validation failed: ${messages.join(', ')}`)
    }
    throw error
  }
}

// Validate verification data
export function validateVerificationData(data: unknown) {
  try {
    return verificationDataSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      throw new Error(`Validation failed: ${messages.join(', ')}`)
    }
    throw error
  }
}
