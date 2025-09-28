import { db } from '../database/connection';
import { logger } from './logger';

/**
 * Create audit log entry
 */
export async function auditLog(
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  newValues?: any,
  oldValues?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      action,
      resourceType,
      resourceId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ]);

    logger.info('Audit log created', {
      userId,
      action,
      resourceType,
      resourceId
    });
  } catch (error) {
    logger.error('Failed to create audit log', {
      error: error.message,
      userId,
      action,
      resourceType,
      resourceId
    });
    // Don't throw error - audit logging should not break main functionality
  }
}