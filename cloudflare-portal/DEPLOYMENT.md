# Deployment Guide - Marlyg Client Portal

## Quick Deployment Checklist

### Development Setup
- [ ] Cloudflare account created
- [ ] Wrangler installed and authenticated
- [ ] D1 database created and initialized
- [ ] R2 bucket created
- [ ] AUTH_SECRET configured
- [ ] ENVIRONMENT set to 'development' in wrangler.toml
- [ ] Worker deployed
- [ ] Test login working (check console for devOTP)

### Production Deployment (⚠️ CRITICAL)
- [ ] **Email service integrated** (SendGrid, Resend, etc.)
- [ ] **EMAIL_API_KEY secret configured**
- [ ] **EMAIL_FROM configured** (noreply@marlyg.net)
- [ ] **ENVIRONMENT changed to 'production'** in wrangler.toml
- [ ] **Test email delivery** working before going live
- [ ] Client emails added to database
- [ ] Worker deployed to production
- [ ] Custom domain configured (portal.marlyg.net)
- [ ] **End-to-end login test** (verify OTP arrives by email)
- [ ] Test file upload/download working

## ⚠️ Production Blocker

**DO NOT deploy to production without email integration.** The portal uses email-based authentication. Users cannot login without receiving OTP codes via email.

## Step-by-Step Deployment

### Phase 1: Prerequisites (5 minutes)

```bash
# 1. Navigate to portal directory
cd cloudflare-portal

# 2. Install dependencies
npm install

# 3. Install Wrangler globally
npm install -g wrangler

# 4. Login to Cloudflare
wrangler login
```

### Phase 2: Database Setup (10 minutes)

```bash
# 1. Create D1 database
npx wrangler d1 create marlyg-portal-db

# 2. Copy the database_id from output
# Update wrangler.toml with the ID:
#   database_id = "YOUR_DATABASE_ID"

# 3. Initialize schema locally (for testing)
npm run db:local

# 4. Initialize schema in production
npm run db:remote

# 5. Verify database created
npx wrangler d1 list
```

### Phase 3: Storage Setup (2 minutes)

```bash
# 1. Create R2 bucket
npx wrangler r2 bucket create marlyg-client-files

# 2. Verify bucket created
npx wrangler r2 bucket list
```

### Phase 4: Security Configuration (5 minutes)

```bash
# 1. Generate a secure secret
openssl rand -hex 32

# 2. Set as environment variable
npx wrangler secret put AUTH_SECRET
# Paste the generated secret when prompted

# 3. Verify secret is set
npx wrangler secret list
```

### Phase 5: Add Client Access (5 minutes)

```bash
# Add your first client (replace with actual data)
npx wrangler d1 execute marlyg-portal-db --remote --command="INSERT INTO users (email, name, company) VALUES ('demo@example.com', 'Demo User', 'Example Corp')"

# Add multiple clients
npx wrangler d1 execute marlyg-portal-db --remote --command="
INSERT INTO users (email, name, company) VALUES 
  ('client1@company.com', 'John Smith', 'Company A'),
  ('client2@company.com', 'Jane Doe', 'Company B')
"

# Verify users added
npx wrangler d1 execute marlyg-portal-db --remote --command="SELECT * FROM users"
```

### Phase 6: Deploy Worker (2 minutes)

```bash
# 1. Test locally first
npm run dev
# Visit http://localhost:8787 to test

# 2. Deploy to production
npm run deploy

# 3. Note the deployed URL
# Example: https://marlyg-client-portal.YOUR-SUBDOMAIN.workers.dev
```

### Phase 7: Custom Domain Setup (10 minutes)

1. **In Cloudflare Dashboard:**
   - Go to **Workers & Pages**
   - Click on `marlyg-client-portal`
   - Go to **Settings** → **Triggers**
   - Under **Custom Domains**, click **Add Custom Domain**
   - Enter: `portal.marlyg.net`
   - Click **Add Custom Domain**

2. **DNS Configuration (automatic):**
   - Cloudflare automatically adds CNAME record
   - Wait 1-2 minutes for propagation
   - SSL certificate auto-provisioned

3. **Verify:**
   - Visit https://portal.marlyg.net
   - Should show login page

### Phase 8: Email Integration (15-30 minutes)

**Option A: SendGrid (Recommended)**

```bash
# 1. Sign up at sendgrid.com (free tier: 100 emails/day)
# 2. Create API key
# 3. Add to Worker
npx wrangler secret put SENDGRID_API_KEY

# 4. Update src/index.ts sendOTP function:
```

```typescript
async function sendOTP(email: string, code: string): Promise<boolean> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email }]
      }],
      from: { email: 'noreply@marlyg.net' },
      subject: 'Your Marlyg Portal Login Code',
      content: [{
        type: 'text/plain',
        value: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`
      }]
    })
  });
  return response.ok;
}
```

**Option B: Resend (Simpler)**

```bash
# 1. Sign up at resend.com
# 2. Add domain marlyg.net
# 3. Create API key
npx wrangler secret put RESEND_API_KEY
```

```typescript
async function sendOTP(email: string, code: string): Promise<boolean> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Marlyg Portal <noreply@marlyg.net>',
      to: email,
      subject: 'Your Login Code',
      text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`
    })
  });
  return response.ok;
}
```

**Option C: Cloudflare Email Workers**

```toml
# Add to wrangler.toml
send_email = [
  {name = "EMAIL"}
]
```

```typescript
async function sendOTP(email: string, code: string): Promise<boolean> {
  await env.EMAIL.send({
    from: "noreply@marlyg.net",
    to: email,
    subject: "Your Marlyg Portal Login Code",
    text: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`
  });
  return true;
}
```

After updating, redeploy:
```bash
npm run deploy
```

### Phase 9: Testing (10 minutes)

**Test Login:**
1. Visit https://portal.marlyg.net
2. Enter an authorized email
3. Check email for OTP (or console if email not integrated)
4. Enter OTP code
5. Should redirect to dashboard

**Test File Upload:**
1. From dashboard, click "Upload Files"
2. Select a file
3. Upload should show progress
4. File should appear in list

**Test File Download:**
1. Click download icon on uploaded file
2. File should download successfully

**Test Logout:**
1. Click logout button
2. Should redirect to login
3. Try accessing /dashboard directly
4. Should redirect to login

### Phase 10: Monitoring Setup (5 minutes)

**Enable Real-time Logs:**
```bash
npx wrangler tail
```

**Cloudflare Dashboard:**
1. Go to **Workers & Pages** → `marlyg-client-portal`
2. View **Metrics** for request analytics
3. Set up **Email Alerts** for errors (optional)

## Post-Deployment

### Client Onboarding Process

1. **Add client to database:**
   ```bash
   npx wrangler d1 execute marlyg-portal-db --remote --command="INSERT INTO users (email, name, company) VALUES ('client@example.com', 'Client Name', 'Company')"
   ```

2. **Send welcome email with instructions:**
   - Portal URL: https://portal.marlyg.net
   - They will receive OTP codes via email
   - No password needed

### Regular Maintenance

**Weekly:**
- Review analytics in Cloudflare dashboard
- Check for failed requests

**Monthly:**
- Clean up expired sessions:
  ```bash
  npx wrangler d1 execute marlyg-portal-db --remote --command="DELETE FROM sessions WHERE expires_at < datetime('now')"
  ```
- Review storage usage

**As Needed:**
- Add/remove client access
- Deploy updates: `npm run deploy`

## Rollback Procedure

If something goes wrong:

```bash
# 1. View deployment history
npx wrangler deployments list

# 2. Rollback to previous version
npx wrangler rollback

# Or deploy a specific version
npx wrangler rollback --deployment-id=DEPLOYMENT_ID
```

## Security Best Practices

✅ Never commit secrets to git  
✅ Use strong AUTH_SECRET (32+ characters)  
✅ Regularly review user access list  
✅ Monitor logs for suspicious activity  
✅ Keep dependencies updated  
✅ Enable 2FA on Cloudflare account  

## Cost Estimates

**Free Tier** (suitable for 1-10 clients):
- Workers: 100,000 requests/day
- D1: 5M reads/day, 100K writes/day
- R2: 10GB storage
- **Cost: $0/month**

**Paid Plan** (10-100 clients):
- Workers Paid: $5/month
- D1 usage-based pricing
- R2: ~$0.015/GB/month
- **Estimated: $10-20/month**

## Support Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **D1 Docs**: https://developers.cloudflare.com/d1/
- **R2 Docs**: https://developers.cloudflare.com/r2/
- **Community**: Cloudflare Discord

## Contact

For deployment assistance: contact@marlyg.net
