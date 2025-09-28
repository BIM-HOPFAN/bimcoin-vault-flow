# TON Blockchain Service

Production-ready Node.js service for TON blockchain operations with Jetton support.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Webhook       │    │   API Server    │    │   Background    │
│   Listeners     │────┤                 │────┤   Workers       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Redis Queue   │    │   TON Network   │
│   Database      │    │   (BullMQ)      │    │   (TonCenter/   │
│                 │    │                 │    │    TonAPI)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components:
- **Webhook Listeners**: Receive blockchain events from TonCenter/TonAPI
- **API Server**: REST endpoints for crediting/debiting operations
- **Background Workers**: Process blockchain transactions with retry logic
- **Database**: PostgreSQL for state management and audit trails
- **Queue**: Redis + BullMQ for reliable job processing

## Flows

### 1. TON Payout (BIM → TON)
```
User requests TON withdrawal → Validate BIM balance → Queue TON transfer → 
Execute on-chain → Update balances → Audit log
```

### 2. Jetton Deposit (Bimcoin → BIM)
```
Webhook receives jetton transfer → Validate transaction → Credit BIM balance → 
Update database → Audit log
```

### 3. Jetton Payout (BIM → Bimcoin)
```
User requests Bimcoin withdrawal → Validate BIM balance → Queue jetton transfer → 
Execute on-chain → Update balances → Audit log
```

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blockchain_service
REDIS_URL=redis://localhost:6379

# TON Network
TON_CENTER_API_KEY=<YOUR_TON_CENTER_API_KEY>
TON_API_KEY=<YOUR_TON_API_KEY>
TON_NETWORK=mainnet  # or testnet

# Treasury Wallets
TREASURY_TON_ADDRESS=<TREASURY_TON_ADDRESS>
TREASURY_JETTON_MASTER=<TREASURY_JETTON_MASTER_ADDRESS>

# Security
TREASURY_PRIVATE_KEY=<ENCRYPTED_PRIVATE_KEY>
WEBHOOK_SECRET=<WEBHOOK_HMAC_SECRET>
JWT_SECRET=<JWT_SECRET>

# KMS (Production)
AWS_KMS_KEY_ID=<KMS_KEY_ID>
HSM_SLOT_ID=<HSM_SLOT_ID>

# Rate Limiting
DAILY_WITHDRAWAL_LIMIT_TON=10
DAILY_WITHDRAWAL_LIMIT_JETTON=1000000

# Monitoring
SENTRY_DSN=<SENTRY_DSN>
LOG_LEVEL=info
```

## Quick Start

```bash
# Install dependencies
npm install

# Setup database
npm run migrate

# Start Redis
docker run -d -p 6379:6379 redis:alpine

# Start development server
npm run dev

# Run tests
npm test
```

## Security Checklist

- ✅ Private keys encrypted with KMS/HSM
- ✅ Multi-sig treasury wallets recommended
- ✅ Rate limiting per user/IP
- ✅ Webhook HMAC verification
- ✅ Input validation and sanitization
- ✅ Audit logs for all transactions
- ✅ Idempotency for all operations
- ✅ Circuit breakers for external APIs
- ✅ Daily withdrawal limits

## Production Deployment

See `deployment/` directory for Docker configurations and deployment scripts.

## API Documentation

- `POST /webhook/jetton-transfer` - Receive jetton deposits
- `POST /api/withdraw/ton` - Request TON withdrawal
- `POST /api/withdraw/jetton` - Request jetton withdrawal
- `GET /api/balance/:address` - Get user balances