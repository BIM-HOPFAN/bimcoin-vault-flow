# Production Deployment Guide

## Security Setup (CRITICAL)

### 1. Treasury Wallet Security
```bash
# NEVER store mnemonic in plaintext
# Use AWS KMS, HashiCorp Vault, or Hardware Security Module (HSM)

# Example with AWS KMS:
export AWS_KMS_KEY_ID="arn:aws:kms:us-west-2:123456789:key/your-key-id"
export KMS_PROVIDER="aws"

# Example with HSM:
export HSM_SLOT_ID="0"
export KMS_PROVIDER="hsm"
```

### 2. Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:secure_password@host:5432/db"
REDIS_URL="redis://user:password@host:6379"

# TON Network
TON_CENTER_API_KEY="your_api_key"
TON_API_KEY="your_tonapi_key"
TREASURY_TON_ADDRESS="EQC..."
TREASURY_JETTON_MASTER="EQD..."

# Security
WEBHOOK_SECRET="generate_256_bit_secret"
JWT_SECRET="generate_256_bit_secret"

# Limits
DAILY_TON_LIMIT="50"
DAILY_JETTON_LIMIT="10000000"
```

### 3. Multi-Signature Setup
- Configure treasury wallet with 2-of-3 or 3-of-5 multisig
- Use separate signers for different operations
- Implement approval workflow for large transactions

## Deployment Steps

### 1. Infrastructure
```bash
# Deploy PostgreSQL cluster with replication
# Deploy Redis cluster with persistence
# Set up load balancer with SSL termination
# Configure monitoring (Prometheus/Grafana)
```

### 2. Application Deployment
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Database Migration
```bash
npm run migrate
```

### 4. Worker Processes
```bash
# Start separate worker processes
docker-compose -f docker-compose.workers.yml up -d
```

## Monitoring & Alerts

### Critical Metrics
- Transaction processing time
- Queue depth and processing rate
- Failed transaction rate
- Treasury wallet balance
- Database connection health
- Redis connection health

### Alert Conditions
- Queue depth > 1000 jobs
- Failed transaction rate > 5%
- Treasury balance < minimum threshold
- Service unavailable > 1 minute

## Security Checklist

- [ ] Treasury keys in KMS/HSM
- [ ] Multi-signature wallets configured
- [ ] Rate limiting enabled
- [ ] Webhook signatures verified
- [ ] Input validation on all endpoints
- [ ] Audit logging enabled
- [ ] Daily backup verification
- [ ] SSL/TLS certificates updated
- [ ] Firewall rules configured
- [ ] Intrusion detection enabled