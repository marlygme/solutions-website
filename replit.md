# Marlyg Solutions Website

## Overview
A static website for Marlyg Solutions, an AI-powered business automation company based in Melbourne, Australia. The site showcases services including automation solutions, cloud integration, and data management.

## Project Structure

### Main Website (marlyg.net)
- **index.html** - Main homepage with hero section, services overview, and contact forms
- **services.html** - Detailed services page
- **ai-solutions.html** - AI and automation solutions
- **portfolio.html** - Portfolio showcase
- **about.html** - About the company
- **contact.html** - Contact form page
- **get-a-quote.html** - Quote request page
- **privacy-policy.html** - Privacy policy page
- **cookies-policy.html** - Cookies policy page
- **server.js** - Node.js static file server
- **update_email.py** - Utility script for updating email addresses across HTML files
- **Assets** - Various PNG images for logos and portfolio items

### Client Portal (portal.marlyg.net)
- **cloudflare-portal/** - Separate Cloudflare Workers project for client portal
  - **src/index.ts** - Worker API endpoints, authentication, file management
  - **public/** - Frontend HTML pages (login, dashboard, files)
  - **schema.sql** - D1 database schema
  - **wrangler.toml** - Cloudflare configuration
  - **README.md** - Portal setup and usage documentation
  - **DEPLOYMENT.md** - Step-by-step deployment guide
  - **PRODUCTION_CHECKLIST.md** - Critical production requirements

## Technology Stack

### Main Website
- **Frontend**: HTML5, Tailwind CSS (via CDN), Font Awesome icons
- **Server**: Node.js HTTP server
- **Forms**: Formspree integration for contact and quote forms
- **Deployment**: Configured for Replit autoscale deployment

### Client Portal
- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: Email-based OTP (one-time PIN)
- **Frontend**: HTML5, Tailwind CSS, vanilla JavaScript
- **Deployment**: Cloudflare Workers with custom domain (portal.marlyg.net)

## Setup
- Static files served via Node.js server on port 5000
- Server configured with cache control headers for development
- All pages use Tailwind CSS for styling and responsive design

## Recent Changes
- **January 2025**: Implemented Cloudflare Workers client portal system
  - Email-based authentication with OTP (no signup)
  - D1 database for user/session management
  - R2 storage for secure file uploads/downloads
  - Production-ready with security measures
  - Comprehensive deployment documentation
- **December 2024**: Website improvements
  - Redesigned header with dropdown menu (Replit-style)
  - Added privacy policy and cookies policy pages
  - Optimized logo display with separate icon/text files
  - Fixed JavaScript navigation errors
- **Initial Setup**:
  - Set up Node.js server to serve static HTML files
  - Configured Replit workflow to run on port 5000
  - Added deployment configuration for production autoscale

## Contact Information
- Email: contact@marlyg.net
- Phone: +61 412 345 678
- ABN: 12 345 678 901
- Forms integrated with Formspree service

## Client Portal Notes

⚠️ **Production Requirement**: The client portal requires email service integration before production deployment. See `cloudflare-portal/PRODUCTION_CHECKLIST.md` for critical setup steps.

**Portal Features**:
- Email-only authentication (no signup - pre-approved clients only)
- Secure file upload/download with R2 storage
- Session management with 7-day expiry
- User-scoped access controls
- Development and production modes

**Security Measures**:
- OTP codes only exposed in development mode
- Environment-based configuration
- Session-based authentication
- HttpOnly, Secure cookies
- CORS configuration
- Authorization checks on all endpoints