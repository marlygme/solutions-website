# Marlyg Solutions Client Portal

A secure client portal built on Cloudflare's serverless infrastructure using Workers, D1 database, and R2 storage.

## Features

✅ **Email-based Authentication** - One-time PIN login (no signup required)  
✅ **Secure File Storage** - Upload and download files with R2  
✅ **Session Management** - 7-day sessions with automatic expiry  
✅ **Client Access Control** - Only pre-approved emails can login  
✅ **Serverless & Scalable** - Runs on Cloudflare's global edge network  

## ⚠️ CRITICAL: Production Requirements

**Before deploying to production, you MUST:**

1. ✅ **Configure email service** - Email integration is REQUIRED for OTP delivery
2. ✅ **Set ENVIRONMENT='production'** in wrangler.toml
3. ✅ **Remove devOTP exposure** - Production mode automatically prevents OTP leakage
4. ✅ **Test email delivery** end-to-end before going live

**The portal will NOT work in production without email integration configured.**  

## Architecture

- **Cloudflare Workers** - API endpoints and authentication
- **D1 Database** - User data, sessions, and file metadata
- **R2 Storage** - Secure file storage
- **HTML Frontend** - Clean, responsive UI with Tailwind CSS

## Prerequisites

1. Cloudflare account (free or paid)
2. Node.js 16.17.0+ and npm
3. Domain configured in Cloudflare (for portal.marlyg.net)

## Setup Instructions

### 1. Install Dependencies

```bash
cd cloudflare-portal
npm install
```

### 2. Install Wrangler CLI (if not already installed)

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

### 4. Create D1 Database

```bash
npx wrangler d1 create marlyg-portal-db
```

Copy the `database_id` from the output and update it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "marlyg-portal-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID
```

### 5. Initialize Database Schema

**Local database (for development):**
```bash
npm run db:local
```

**Production database:**
```bash
npm run db:remote
```

### 6. Create R2 Bucket

```bash
npx wrangler r2 bucket create marlyg-client-files
```

This bucket is already configured in `wrangler.toml`.

### 7. Set Secret Environment Variables

Set your authentication secret:

```bash
npx wrangler secret put AUTH_SECRET
```

Enter a secure random string (generate one with: `openssl rand -hex 32`)

### 8. Add Authorized Client Emails

Edit `schema.sql` and add your client emails to the users table, then run:

```bash
npm run db:remote
```

Or manually insert users:

```bash
npx wrangler d1 execute marlyg-portal-db --remote --command="INSERT INTO users (email, name, company) VALUES ('client@example.com', 'Client Name', 'Company Name')"
```

### 9. Configure Custom Domain (portal.marlyg.net)

In Cloudflare Dashboard:

1. Go to **Workers & Pages**
2. Select your deployed worker
3. Go to **Settings** → **Triggers**
4. Click **Add Custom Domain**
5. Enter `portal.marlyg.net`
6. Cloudflare will automatically configure DNS

### 10. Deploy

**Development (local):**
```bash
npm run dev
```

**Production:**
```bash
npm run deploy
```

After deployment, your portal will be live at:
- `https://marlyg-client-portal.YOUR-SUBDOMAIN.workers.dev`
- `https://portal.marlyg.net` (after custom domain setup)

## Project Structure

```
cloudflare-portal/
├── src/
│   └── index.ts          # Worker code (API endpoints, auth)
├── public/
│   ├── login.html        # Login page with OTP
│   ├── dashboard.html    # Client dashboard
│   └── files.html        # File manager
├── schema.sql            # D1 database schema
├── wrangler.toml         # Cloudflare configuration
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## API Endpoints

### Authentication
- `POST /api/auth/request-otp` - Request login OTP
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/logout` - Logout user

### User
- `GET /api/user` - Get current user info

### Files
- `GET /api/files` - List user's files
- `POST /api/upload` - Upload file to R2
- `GET /api/download/:fileId` - Download file from R2

## Email Integration (REQUIRED FOR PRODUCTION)

⚠️ **IMPORTANT**: The portal uses email-based authentication. Without email integration, users cannot receive OTP codes and cannot login.

### Development vs Production

- **Development Mode** (`ENVIRONMENT='development'`):
  - OTP codes logged to console
  - `devOTP` field included in API response for testing
  - Email service NOT required

- **Production Mode** (`ENVIRONMENT='production'`):
  - Email service REQUIRED
  - `devOTP` field automatically removed from responses
  - Throws error if EMAIL_API_KEY not configured

### Email Service Integration

### Option 1: Cloudflare Email Workers
```typescript
await env.EMAIL.send({
  from: "noreply@marlyg.net",
  to: email,
  subject: "Your Login Code",
  text: `Your login code is: ${otp}`
});
```

### Option 2: SendGrid
```bash
npm install @sendgrid/mail
npx wrangler secret put SENDGRID_API_KEY
```

### Option 3: Resend
```bash
npm install resend
npx wrangler secret put RESEND_API_KEY
```

Update the `sendOTP()` function in `src/index.ts` with your chosen provider.

## Security Features

✅ Email-based authentication (no passwords stored)  
✅ Session tokens with 7-day expiry  
✅ HttpOnly, Secure, SameSite cookies  
✅ Authorization checks on all API endpoints  
✅ User-scoped file access (users can only access their own files)  
✅ CORS headers configured  

## Managing Client Access

### Add a new client:
```bash
npx wrangler d1 execute marlyg-portal-db --remote --command="INSERT INTO users (email, name, company) VALUES ('newclient@example.com', 'Client Name', 'Company Inc')"
```

### Remove client access:
```bash
npx wrangler d1 execute marlyg-portal-db --remote --command="DELETE FROM users WHERE email = 'client@example.com'"
```

### List all clients:
```bash
npx wrangler d1 execute marlyg-portal-db --remote --command="SELECT * FROM users"
```

## Development Workflow

1. Make code changes
2. Test locally: `npm run dev`
3. Test at `http://localhost:8787`
4. Deploy: `npm run deploy`

## Monitoring

View logs in real-time:
```bash
npx wrangler tail
```

View analytics in Cloudflare Dashboard:
- Go to **Workers & Pages**
- Select your worker
- View **Metrics** tab

## Pricing (Cloudflare Free Tier Limits)

- **Workers**: 100,000 requests/day
- **D1**: 5M reads/day, 100K writes/day, 500MB storage
- **R2**: 10GB storage, 1M Class A operations/month

For most client portals, the free tier is sufficient. Paid plans start at $5/month for Workers and scale as needed.

## Troubleshooting

**OTP not sending:**
- Check console logs for dev OTP code
- Integrate email service (see Email Integration section)

**Database errors:**
- Run `npm run db:remote` to ensure schema is initialized
- Check D1 dashboard in Cloudflare for data

**Authentication fails:**
- Verify AUTH_SECRET is set: `npx wrangler secret list`
- Check browser console for errors
- Verify user email exists in database

**File upload fails:**
- Check R2 bucket exists: `npx wrangler r2 bucket list`
- Verify bucket binding in `wrangler.toml`

## Next Steps

1. **Integrate email service** for OTP delivery
2. **Add project management** features
3. **Implement file sharing** between clients and admins
4. **Add notifications** system
5. **Setup automated backups** for D1 database

## Support

For questions or issues, contact: contact@marlyg.net

## License

Proprietary - Marlyg Solutions © 2025
