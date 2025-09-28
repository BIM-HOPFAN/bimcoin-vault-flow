import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_URL',
  'TREASURY_TON_ADDRESS',
  'TREASURY_JETTON_MASTER',
  'TON_CENTER_API_KEY',
  'WEBHOOK_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL!,
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  },

  // TON network configuration
  ton: {
    network: process.env.TON_NETWORK || 'mainnet',
    endpoint: process.env.TON_NETWORK === 'testnet' 
      ? 'https://testnet.toncenter.com/api/v2/jsonRPC'
      : 'https://toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TON_CENTER_API_KEY!
  },

  // TonAPI configuration
  tonApi: {
    key: process.env.TON_API_KEY || '',
    baseUrl: process.env.TON_NETWORK === 'testnet'
      ? 'https://testnet.tonapi.io'
      : 'https://tonapi.io'
  },

  // Treasury configuration
  treasury: {
    tonAddress: process.env.TREASURY_TON_ADDRESS!,
    jettonMaster: process.env.TREASURY_JETTON_MASTER!,
    mnemonic: process.env.TREASURY_MNEMONIC, // SECURITY: Use KMS in production
  },

  // Security configuration
  security: {
    webhookSecret: process.env.WEBHOOK_SECRET!,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100')
  },

  // Business logic configuration
  limits: {
    dailyTonWithdrawal: parseFloat(process.env.DAILY_TON_LIMIT || '10'),
    dailyJettonWithdrawal: parseFloat(process.env.DAILY_JETTON_LIMIT || '1000000'),
    minTonWithdrawal: parseFloat(process.env.MIN_TON_WITHDRAWAL || '0.1'),
    minJettonWithdrawal: parseFloat(process.env.MIN_JETTON_WITHDRAWAL || '1'),
    maxRetries: parseInt(process.env.MAX_TRANSACTION_RETRIES || '3')
  },

  // Exchange rates (BIM to TON/Jetton)
  rates: {
    bimToTon: parseFloat(process.env.BIM_TO_TON_RATE || '0.005'), // 1 BIM = 0.005 TON
    bimToJetton: parseFloat(process.env.BIM_TO_JETTON_RATE || '1'), // 1 BIM = 1 Jetton
    tonToBim: parseFloat(process.env.TON_TO_BIM_RATE || '200'), // 1 TON = 200 BIM
    jettonToBim: parseFloat(process.env.JETTON_TO_BIM_RATE || '1') // 1 Jetton = 1 BIM
  },

  // KMS/HSM configuration (for production)
  kms: {
    provider: process.env.KMS_PROVIDER || 'none', // 'aws', 'azure', 'hashicorp', 'hsm', 'none'
    awsRegion: process.env.AWS_REGION,
    awsKeyId: process.env.AWS_KMS_KEY_ID,
    hsmSlotId: process.env.HSM_SLOT_ID,
    vaultUrl: process.env.VAULT_URL,
    vaultPath: process.env.VAULT_SECRET_PATH
  },

  // Monitoring configuration
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090')
  }
};