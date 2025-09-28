# Production Deployment Runbook

## Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Set up production server (minimum 4GB RAM, 2 CPU cores)
- [ ] Install Docker and Docker Compose
- [ ] Configure firewall (only allow ports 22, 80, 443)
- [ ] Set up SSL certificates
- [ ] Configure domain DNS

### 2. Database Setup
```bash
# Create production database
createdb blockchain_service

# Run migrations
psql -d blockchain_service -f src/database/schema.sql
```

### 3. Security Configuration
- [ ] Generate secure secrets (256-bit minimum)
- [ ] Configure KMS/HSM for treasury keys
- [ ] Set up multi-signature treasury wallets
- [ ] Configure IP whitelisting for admin endpoints

### 4. Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
# Critical - MUST be changed
WEBHOOK_SECRET="$(openssl rand -hex 32)"
JWT_SECRET="$(openssl rand -hex 32)"
ADMIN_TOKEN="$(openssl rand -hex 32)"

# Treasury addresses (get from wallet setup)
TREASURY_TON_ADDRESS="EQC..."
TREASURY_JETTON_MASTER="EQD..."

# Database
DATABASE_URL="postgresql://user:secure_password@host:5432/blockchain_service"
REDIS_URL="redis://user:password@host:6379"

# API Keys
TON_CENTER_API_KEY="your_toncenter_api_key"
TON_API_KEY="your_tonapi_key"

# KMS Configuration (CRITICAL)
KMS_PROVIDER="aws" # or azure, hashicorp, hsm
AWS_KMS_KEY_ID="arn:aws:kms:region:account:key/key-id"
```

## Deployment Steps

### Step 1: Initial Deployment
```bash
# Clone repository
git clone <repository-url>
cd blockchain-service

# Copy production environment
cp .env.example .env
# Edit .env with production values

# Deploy with Docker Compose
docker-compose -f deployment/docker-compose.prod.yml up -d
```

### Step 2: Verify Deployment
```bash
# Check service health
curl https://your-domain.com/health

# Check logs
docker-compose logs -f blockchain-service

# Verify database connectivity
docker-compose exec postgres psql -U postgres -d blockchain_service -c "SELECT version();"

# Check Redis
docker-compose exec redis redis-cli ping
```

### Step 3: Configure Monitoring
```bash
# Access Grafana
# URL: https://your-domain.com:3001
# Login: admin / <GRAFANA_PASSWORD>

# Import dashboard configuration
# Import blockchain-service dashboard from monitoring/grafana-dashboard.json
```

### Step 4: Set Up Webhooks
Configure TonCenter/TonAPI webhooks to point to:
```
https://your-domain.com/webhook/jetton-transfer
```

Include webhook signature in headers:
```
X-Webhook-Signature: sha256=<signature>
X-Webhook-Timestamp: <timestamp>
```

## Post-Deployment Verification

### 1. Health Checks
```bash
# Service health
curl https://your-domain.com/health

# Treasury balance
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-domain.com/admin/treasury-balance

# System stats
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-domain.com/admin/stats
```

### 2. Test Transactions
```bash
# Test balance query
curl https://your-domain.com/api/balance/EQC...

# Test TON withdrawal (with valid user address)
curl -X POST https://your-domain.com/api/withdraw/ton \
  -H "Content-Type: application/json" \
  -d '{"userAddress":"EQC...","amount":"0.1"}'
```

### 3. Monitoring Setup
- [ ] Set up alerts for high queue depth
- [ ] Set up alerts for failed transactions
- [ ] Set up alerts for low treasury balance
- [ ] Set up uptime monitoring

## Scaling Considerations

### Horizontal Scaling
```bash
# Scale API servers
docker-compose -f deployment/docker-compose.prod.yml up -d --scale blockchain-service=3

# Scale workers
docker-compose -f deployment/docker-compose.prod.yml up -d --scale blockchain-worker=5
```

### Database Scaling
- Set up read replicas for analytics queries
- Consider database sharding for high transaction volumes
- Implement connection pooling (PgBouncer)

### Redis Scaling
- Set up Redis Cluster for high availability
- Consider Redis Sentinel for failover

## Security Hardening

### 1. Network Security
```bash
# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny incoming
ufw enable
```

### 2. SSL/TLS Configuration
- Use Let's Encrypt or commercial SSL certificates
- Configure HSTS headers
- Set up certificate auto-renewal

### 3. Access Control
- Implement IP whitelisting for admin endpoints
- Use VPN for admin access
- Set up audit logging for all admin actions

### 4. Regular Security Tasks
- [ ] Update dependencies monthly
- [ ] Rotate secrets quarterly
- [ ] Review access logs weekly
- [ ] Backup verification daily

## Backup & Recovery

### Database Backup
```bash
# Daily automated backup
pg_dump blockchain_service | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip -c backup_20231201.sql.gz | psql blockchain_service
```

### Configuration Backup
```bash
# Backup environment and configurations
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env deployment/
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check container memory
   docker stats
   
   # Restart if needed
   docker-compose restart blockchain-service
   ```

2. **Database Connection Issues**
   ```bash
   # Check connections
   docker-compose exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"
   
   # Restart if needed
   docker-compose restart postgres
   ```

3. **Queue Backup**
   ```bash
   # Check Redis queue
   docker-compose exec redis redis-cli llen "bull:tonPayout:waiting"
   
   # Scale workers if needed
   docker-compose up -d --scale blockchain-worker=10
   ```

### Emergency Procedures

1. **Emergency Stop**
   ```bash
   # Stop all services
   docker-compose down
   
   # Or use admin endpoint
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://your-domain.com/admin/emergency-pause
   ```

2. **Rollback Deployment**
   ```bash
   # Rollback to previous version
   git checkout <previous-commit>
   docker-compose -f deployment/docker-compose.prod.yml up -d --build
   ```

## Maintenance

### Regular Tasks
- [ ] Check logs daily
- [ ] Monitor treasury balance
- [ ] Review failed transactions
- [ ] Update dependencies monthly
- [ ] Test backup restoration monthly

### Performance Optimization
- Monitor database query performance
- Optimize queue processing rates
- Review and adjust rate limits
- Scale based on traffic patterns

## Support Contacts
- DevOps: devops@company.com
- Security: security@company.com
- Blockchain Team: blockchain@company.com