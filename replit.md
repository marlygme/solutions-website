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
- **server.js** - Node.js server with static files and portal API
- **update_email.py** - Utility script for updating email addresses across HTML files
- **Assets** - Various PNG images for logos and portfolio items

### Client Portal (marlyg.net/portal)
- **portal/** - Integrated client portal pages
  - **login.html** - Email-based OTP login page
  - **dashboard.html** - Client dashboard with file stats
  - **files.html** - File management interface
- **portal-db.js** - SQLite database module for portal
  - User management and authentication
  - Session management
  - File metadata storage
- **portal.db** - SQLite database file (auto-created)
- **public/uploads/** - Directory for uploaded client files
- **cloudflare-portal/** - Legacy Cloudflare Workers version (not in use)

## Technology Stack

### Main Website
- **Frontend**: HTML5, Tailwind CSS (via CDN), Font Awesome icons
- **Server**: Node.js HTTP server with integrated portal API
- **Forms**: Formspree integration for contact and quote forms
- **Deployment**: Configured for Replit autoscale deployment

### Client Portal
- **Runtime**: Integrated Node.js server (same as main website)
- **Database**: SQLite (better-sqlite3)
- **Storage**: Local file system (public/uploads/)
- **Authentication**: Email-based OTP (one-time PIN)
- **Frontend**: HTML5, Tailwind CSS, vanilla JavaScript
- **Access**: marlyg.net/portal (integrated with main deployment)

## Setup
- Static files served via Node.js server on port 5000
- Server configured with cache control headers for development
- All pages use Tailwind CSS for styling and responsive design

## Recent Changes
- **October 2025**: Integrated client portal into main Node.js server
  - Email-based OTP authentication (no signup required)
  - SQLite database for users, sessions, and file metadata
  - Secure file upload/download with local storage
  - Session management with 7-day expiry
  - HttpOnly, Secure, SameSite cookies
  - User-scoped file access controls
  - Available at /portal route on main website
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

⚠️ **Development Mode**: Currently running in development mode - OTP codes are logged to the server console instead of being emailed. Email service integration needed for production.

**Portal Features**:
- Email-only authentication (no signup required - any email can request a code)
- Secure file upload/download with local storage
- Session management with 7-day expiry
- User-scoped access controls (users only see their own files)
- Clean, modern UI matching main website design

**Security Measures**:
- OTP codes NOT exposed in API responses (only in server console)
- Session-based authentication with secure tokens
- HttpOnly, Secure, SameSite=Strict cookies
- Authorization checks on all file operations
- Files scoped to individual users
- 15-minute OTP expiry
- Session tokens stored in database

**How to Use**:
1. Visit marlyg.net/portal
2. Enter your email address
3. Check the server console logs for your 6-digit code
4. Enter the code to log in
5. Upload and manage files from the dashboard