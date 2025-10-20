# Production Deployment Checklist

## ⚠️ CRITICAL - Email Service Integration

**STATUS: ❌ NOT CONFIGURED**

The portal **CANNOT** be used in production without email integration. Users will not receive OTP codes.

### Required Actions:

1. **Choose email provider** (pick one):
   - [ ] SendGrid (recommended, 100 emails/day free)
   - [ ] Resend (10,000 emails/month free)
   - [ ] Cloudflare Email Workers
   - [ ] AWS SES
   - [ ] Other SMTP service

2. **Get API credentials:**
   - [ ] Sign up for email service
   - [ ] Create API key
   - [ ] Verify sending domain (marlyg.net)

3. **Configure Worker:**
   - [ ] Set `EMAIL_API_KEY` secret: `npx wrangler secret put EMAIL_API_KEY`
   - [ ] Set `EMAIL_FROM` secret: `npx wrangler secret put EMAIL_FROM`
   - [ ] Update `sendOTP()` function in `src/index.ts` with provider integration code
   - [ ] Remove the `throw new Error` at end of `sendOTP()`

4. **Test email delivery:**
   - [ ] Deploy to staging
   - [ ] Request OTP for test email
   - [ ] Verify email arrives
   - [ ] Verify OTP code works

5. **Switch to production mode:**
   - [ ] Set `ENVIRONMENT = "production"` in `wrangler.toml`
   - [ ] Deploy: `npm run deploy`
   - [ ] Verify `devOTP` is NOT in API response
   - [ ] Test full login flow

---

## Security Checklist

- [ ] `AUTH_SECRET` is 32+ characters random string
- [ ] `ENVIRONMENT` set to "production" in wrangler.toml
- [ ] Email service API key configured
- [ ] Only authorized client emails in database
- [ ] Custom domain (portal.marlyg.net) configured with SSL
- [ ] Test that devOTP is NOT exposed in production responses
- [ ] 2FA enabled on Cloudflare account

---

## Deployment Steps

### 1. Email Integration (30 minutes)

**Example: SendGrid Integration**

```typescript
// In src/index.ts, replace sendOTP function:

async function sendOTP(email: string, code: string, env: Env): Promise<boolean> {
  if (env.ENVIRONMENT === 'production' && (!env.EMAIL_API_KEY || !env.EMAIL_FROM)) {
    throw new Error('Email service not configured.');
  }
  
  if (env.ENVIRONMENT !== 'production') {
    console.log(`[DEV] OTP for ${email}: ${code}`);
    return true;
  }
  
  // SendGrid Integration
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }]
      }],
      from: { 
        email: env.EMAIL_FROM,
        name: 'Marlyg Solutions'
      },
      subject: 'Your Marlyg Portal Login Code',
      content: [{
        type: 'text/html',
        value: `
          <h2>Your Login Code</h2>
          <p>Your one-time login code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 8px;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        `
      }]
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('SendGrid error:', error);
    throw new Error('Failed to send email');
  }
  
  return true;
}
```

**Configure secrets:**
```bash
npx wrangler secret put EMAIL_API_KEY
# Enter your SendGrid API key

npx wrangler secret put EMAIL_FROM
# Enter: noreply@marlyg.net
```

### 2. Production Configuration

**Update wrangler.toml:**
```toml
[vars]
PORTAL_DOMAIN = "portal.marlyg.net"
ENVIRONMENT = "production"  # Changed from "development"
```

### 3. Deploy

```bash
npm run deploy
```

### 4. Verify Security

**Test that OTP is NOT exposed:**
```bash
curl -X POST https://portal.marlyg.net/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Response should NOT contain "devOTP" field:
{
  "success": true,
  "message": "OTP sent to your email"
}
```

### 5. End-to-End Test

1. Visit https://portal.marlyg.net
2. Enter authorized email address
3. Check email inbox for OTP code
4. Enter OTP code
5. Should login successfully
6. Test file upload
7. Test file download
8. Test logout

---

## Post-Deployment Monitoring

### Monitor Email Delivery

```bash
# View real-time logs
npx wrangler tail

# Look for:
# - "Failed to send OTP" errors
# - Email service API errors
# - Authentication failures
```

### Common Issues

**Problem**: OTP emails not arriving

**Solutions:**
1. Check spam folder
2. Verify EMAIL_FROM domain is authenticated
3. Check email service dashboard for bounces
4. Review Wrangler logs for errors
5. Test with different email provider (Gmail, Outlook, etc.)

**Problem**: "Email service not configured" error

**Solutions:**
1. Verify `EMAIL_API_KEY` secret exists: `npx wrangler secret list`
2. Verify `EMAIL_FROM` secret exists
3. Check `ENVIRONMENT` is set to "production" in wrangler.toml

---

## Rollback Plan

If issues occur after production deployment:

```bash
# 1. Immediate rollback
npx wrangler rollback

# 2. Or switch back to development mode
# Edit wrangler.toml:
# ENVIRONMENT = "development"
npm run deploy

# 3. Check logs for root cause
npx wrangler tail
```

---

## Final Verification

Before announcing portal to clients:

- [ ] Portal accessible at https://portal.marlyg.net
- [ ] SSL certificate valid
- [ ] Email delivery working (test with 3+ different email providers)
- [ ] devOTP NOT exposed in API responses
- [ ] File upload working
- [ ] File download working
- [ ] Session persistence working (close browser, reopen, still logged in)
- [ ] Session expiry working (after 7 days)
- [ ] Logout working
- [ ] Unauthorized emails cannot login
- [ ] Monitoring/logging configured

---

## Support

If you encounter issues during production deployment:
- Email: contact@marlyg.net
- Cloudflare Discord: #workers channel
- SendGrid Support: https://support.sendgrid.com

**Current Status: Email integration required before production use.**
