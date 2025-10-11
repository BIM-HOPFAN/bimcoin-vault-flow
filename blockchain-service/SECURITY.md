# Security Guidelines for Blockchain Service

## Critical Security Requirements

### 1. Secret Management

**NEVER store treasury mnemonics in .env files or any configuration files.**

#### Production Secret Management
All production secrets MUST be stored in secure secret management systems:

- **AWS KMS** (Recommended)
  - Encrypted at rest and in transit
  - Hardware-backed key storage
  - Fine-grained access controls
  - Audit logging

- **HashiCorp Vault**
  - Dynamic secret generation
  - Encryption as a service
  - Detailed audit trails

- **Azure Key Vault**
  - FIPS 140-2 Level 2 validated HSMs
  - Role-based access control
  - Comprehensive logging

- **Hardware Security Modules (HSM)**
  - FIPS 140-2 Level 3+ compliance
  - Tamper-resistant hardware
  - Highest security for high-value treasury operations

#### Local Development
- Use dedicated test wallets with minimal funds only
- Never use production mnemonics in development environments
- Rotate test mnemonics regularly
- Keep test mnemonics out of version control

### 2. Environment Variables

#### Required Secrets (Must be in KMS/HSM):
- `TREASURY_MNEMONIC` - Treasury wallet recovery phrase
- `WEBHOOK_SECRET` - Webhook signature verification key
- `JWT_SECRET` - Session token signing key
- `TON_CENTER_API_KEY` - TON API access credentials
- `TON_API_KEY` - TON blockchain API key

#### Configuration (Can be in environment):
- `TREASURY_TON_ADDRESS` - Public treasury address
- `TREASURY_JETTON_MASTER` - Public jetton master address
- Network configuration
- Rate limiting settings
- Business logic parameters

### 3. KMS Integration

Configure KMS provider in production:

```bash
# AWS KMS
KMS_PROVIDER=aws
AWS_REGION=us-west-2
AWS_KMS_KEY_ID=arn:aws:kms:region:account:key/key-id

# HashiCorp Vault
KMS_PROVIDER=vault
VAULT_URL=https://vault.company.com
VAULT_SECRET_PATH=secret/blockchain-service/treasury

# HSM
KMS_PROVIDER=hsm
HSM_SLOT_ID=0
HSM_PIN_FILE=/secure/hsm-pin
```

### 4. Secret Rotation

Implement regular secret rotation:
- Treasury mnemonics: Never rotate (use new wallets instead)
- API keys: Rotate every 90 days
- Webhook secrets: Rotate every 30 days
- JWT secrets: Rotate every 7 days

### 5. Access Control

Limit access to production secrets:
- Only authorized DevOps personnel
- Multi-person approval for secret access
- All access logged and audited
- Require MFA for secret management operations

### 6. Git Security

Ensure secrets never enter version control:
- Verify .env is in .gitignore
- Use git-secrets or similar tools
- Scan commit history for leaked secrets
- If secrets are found, rotate immediately

### 7. Deployment Security

Production deployment checklist:
- [ ] All secrets in KMS/HSM
- [ ] No .env file deployed to production
- [ ] Secrets injected at runtime only
- [ ] Audit logging enabled
- [ ] Network security groups configured
- [ ] HTTPS/TLS enforced
- [ ] Rate limiting enabled
- [ ] Monitoring alerts configured

### 8. Incident Response

If a secret is compromised:
1. Immediately rotate the compromised secret
2. Audit all access using the old secret
3. Review system logs for unauthorized activity
4. Notify security team
5. Update incident response documentation
6. Implement additional controls to prevent recurrence

## References

- [OWASP Secret Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [HashiCorp Vault Security Model](https://www.vaultproject.io/docs/internals/security)
