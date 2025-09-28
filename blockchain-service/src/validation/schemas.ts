import Joi from 'joi';

/**
 * Validation schemas for API requests
 */

// TON address validation (basic format check)
const tonAddressSchema = Joi.string()
  .pattern(/^[A-Za-z0-9_-]{48}$|^EQ[A-Za-z0-9_-]{46}$/)
  .required()
  .messages({
    'string.pattern.base': 'Invalid TON address format'
  });

// Withdrawal amount validation
const withdrawalAmountSchema = Joi.number()
  .positive()
  .precision(9) // Max 9 decimal places
  .required()
  .messages({
    'number.positive': 'Amount must be positive',
    'number.base': 'Amount must be a valid number'
  });

/**
 * TON withdrawal request validation
 */
export const tonWithdrawalSchema = Joi.object({
  userAddress: tonAddressSchema,
  amount: withdrawalAmountSchema.min(0.1).messages({
    'number.min': 'Minimum TON withdrawal is 0.1 TON'
  })
});

/**
 * Jetton withdrawal request validation
 */
export const jettonWithdrawalSchema = Joi.object({
  userAddress: tonAddressSchema,
  amount: withdrawalAmountSchema.min(1).messages({
    'number.min': 'Minimum Jetton withdrawal is 1 token'
  })
});

/**
 * Webhook jetton transfer validation
 */
export const jettonTransferWebhookSchema = Joi.object({
  transaction: Joi.object({
    hash: Joi.string().required(),
    now: Joi.number().integer().positive().required(),
    account: Joi.object({
      address: tonAddressSchema
    }).required(),
    in_msg: Joi.object({
      source: tonAddressSchema.allow(null),
      destination: tonAddressSchema,
      value: Joi.string().required(),
      message: Joi.string().allow(''),
      body: Joi.string().allow('')
    }).required()
  }).required(),
  jetton: Joi.object({
    master: tonAddressSchema,
    wallet: tonAddressSchema
  }).required()
});

/**
 * Balance query validation
 */
export const balanceQuerySchema = Joi.object({
  address: tonAddressSchema
});

/**
 * Admin transaction retry validation
 */
export const transactionRetrySchema = Joi.object({
  transactionId: Joi.string().uuid().required()
});

/**
 * Generic pagination validation
 */
export const paginationSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * User creation validation
 */
export const userCreationSchema = Joi.object({
  address: tonAddressSchema,
  metadata: Joi.object().optional()
});

/**
 * Webhook signature validation
 */
export const webhookSignatureSchema = Joi.object({
  signature: Joi.string().required(),
  timestamp: Joi.string().required(),
  body: Joi.string().required()
});

/**
 * Rate limiting validation
 */
export const rateLimitSchema = Joi.object({
  identifier: Joi.string().required(), // IP or user ID
  action: Joi.string().valid('withdrawal', 'api', 'webhook').required(),
  timestamp: Joi.number().integer().positive().required()
});

/**
 * Transaction confirmation validation
 */
export const transactionConfirmationSchema = Joi.object({
  txHash: Joi.string().required(),
  confirmations: Joi.number().integer().min(0),
  status: Joi.string().valid('pending', 'confirmed', 'failed')
});