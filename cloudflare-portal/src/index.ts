/**
 * Marlyg Solutions Client Portal
 * Cloudflare Workers with D1 Database and R2 Storage
 */

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PORTAL_DOMAIN: string;
  AUTH_SECRET: string;
  ENVIRONMENT?: string; // 'production' or 'development'
  EMAIL_API_KEY?: string; // SendGrid, Resend, etc.
  EMAIL_FROM?: string; // noreply@marlyg.net
}

interface User {
  id: number;
  email: string;
  name: string | null;
  company: string | null;
}

// Helper: Hash password with salt
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper: Generate secure session token
function generateToken(): string {
  return crypto.randomUUID();
}

// Helper: Send email OTP
async function sendOTP(email: string, code: string, env: Env): Promise<boolean> {
  // SECURITY: Only allow missing email config in development mode
  // If ENVIRONMENT is undefined or "production", email service is REQUIRED
  const isDevelopment = env.ENVIRONMENT === 'development';
  
  if (!isDevelopment && (!env.EMAIL_API_KEY || !env.EMAIL_FROM)) {
    throw new Error('Email service not configured. Set EMAIL_API_KEY and EMAIL_FROM environment variables.');
  }
  
  // Development mode: log to console only (explicit check)
  if (env.ENVIRONMENT === 'development') {
    console.log(`[DEV] OTP for ${email}: ${code}`);
    return true;
  }
  
  // TODO: Integrate with your email service provider
  // Example for SendGrid:
  // const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${env.EMAIL_API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({
  //     personalizations: [{ to: [{ email }] }],
  //     from: { email: env.EMAIL_FROM },
  //     subject: 'Your Marlyg Portal Login Code',
  //     content: [{
  //       type: 'text/plain',
  //       value: `Your login code is: ${code}\n\nThis code expires in 10 minutes.`
  //     }]
  //   })
  // });
  // return response.ok;
  
  throw new Error('Email service integration not implemented. See sendOTP function in src/index.ts');
}

// Helper: Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Middleware: Authenticate user from session token
async function authenticate(request: Request, env: Env): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('Cookie');
  
  let token: string | null = null;
  
  // Check Authorization header first
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  // Check session cookie
  else if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...v] = c.trim().split('=');
        return [key, v.join('=')];
      })
    );
    token = cookies['session_token'];
  }
  
  if (!token) return null;
  
  // Verify session in D1
  const session = await env.DB.prepare(
    `SELECT s.*, u.id, u.email, u.name, u.company 
     FROM sessions s 
     JOIN users u ON s.user_id = u.id 
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();
  
  if (!session) return null;
  
  return {
    id: session.id as number,
    email: session.email as string,
    name: session.name as string | null,
    company: session.company as string | null
  };
}

// CORS helper
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    
    // API Routes
    if (path.startsWith('/api/')) {
      return handleAPI(request, env, path);
    }
    
    // Serve frontend
    return serveFrontend(request, env, path);
  }
};

async function handleAPI(request: Request, env: Env, path: string): Promise<Response> {
  const url = new URL(request.url);
  
  // POST /api/auth/request-otp - Request login OTP
  if (path === '/api/auth/request-otp' && request.method === 'POST') {
    const { email } = await request.json() as { email: string };
    
    // Check if user exists (email-only, no signup)
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (!user) {
      return Response.json({ error: 'Email not authorized. Please contact support.' }, { 
        status: 403,
        headers: corsHeaders()
      });
    }
    
    // Generate OTP and store temporarily (use KV or D1)
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store OTP in sessions table temporarily
    await env.DB.prepare(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)`
    ).bind(user.id, `OTP:${email}:${otp}`, expiresAt.toISOString()).run();
    
    // Send OTP via email
    try {
      await sendOTP(email, otp, env);
    } catch (error) {
      console.error('Failed to send OTP:', error);
      return Response.json({ 
        error: 'Failed to send login code. Email service not configured.' 
      }, { 
        status: 500,
        headers: corsHeaders()
      });
    }
    
    // Build response - only include devOTP in development
    const response: any = { 
      success: true, 
      message: 'OTP sent to your email'
    };
    
    // SECURITY: Only expose OTP when explicitly in development mode
    // Using positive check - undefined ENVIRONMENT will NOT expose devOTP
    if (env.ENVIRONMENT === 'development') {
      response.devOTP = otp;
    }
    
    return Response.json(response, { headers: corsHeaders() });
  }
  
  // POST /api/auth/verify-otp - Verify OTP and create session
  if (path === '/api/auth/verify-otp' && request.method === 'POST') {
    const { email, otp } = await request.json() as { email: string; otp: string };
    
    // Verify OTP
    const otpSession = await env.DB.prepare(
      `SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')`
    ).bind(`OTP:${email}:${otp}`).first();
    
    if (!otpSession) {
      return Response.json({ error: 'Invalid or expired OTP' }, { 
        status: 401,
        headers: corsHeaders()
      });
    }
    
    // Delete OTP session
    await env.DB.prepare(
      'DELETE FROM sessions WHERE token = ?'
    ).bind(`OTP:${email}:${otp}`).run();
    
    // Create permanent session
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await env.DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(otpSession.user_id, sessionToken, expiresAt.toISOString()).run();
    
    // Update last login
    await env.DB.prepare(
      `UPDATE users SET last_login = datetime('now') WHERE id = ?`
    ).bind(otpSession.user_id).run();
    
    return Response.json({ 
      success: true, 
      token: sessionToken,
      expiresAt: expiresAt.toISOString()
    }, { 
      headers: {
        ...corsHeaders(),
        'Set-Cookie': `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
      }
    });
  }
  
  // GET /api/user - Get current user info
  if (path === '/api/user' && request.method === 'GET') {
    const user = await authenticate(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { 
        status: 401,
        headers: corsHeaders()
      });
    }
    
    return Response.json({ user }, { headers: corsHeaders() });
  }
  
  // GET /api/files - List user's files
  if (path === '/api/files' && request.method === 'GET') {
    const user = await authenticate(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    
    const files = await env.DB.prepare(
      'SELECT id, filename, file_size, mime_type, description, uploaded_at FROM files WHERE user_id = ? ORDER BY uploaded_at DESC'
    ).bind(user.id).all();
    
    return Response.json({ files: files.results }, { headers: corsHeaders() });
  }
  
  // POST /api/upload - Upload file to R2
  if (path === '/api/upload' && request.method === 'POST') {
    const user = await authenticate(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders() });
    }
    
    // Generate unique R2 key
    const key = `users/${user.id}/${crypto.randomUUID()}-${file.name}`;
    
    // Upload to R2
    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    });
    
    // Save metadata to D1
    await env.DB.prepare(
      'INSERT INTO files (user_id, filename, r2_key, file_size, mime_type, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user.id, file.name, key, file.size, file.type, description || null).run();
    
    return Response.json({ success: true, filename: file.name }, { headers: corsHeaders() });
  }
  
  // GET /api/download/:fileId - Download file from R2
  if (path.startsWith('/api/download/') && request.method === 'GET') {
    const user = await authenticate(request, env);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const fileId = parseInt(path.split('/').pop() || '');
    
    // Get file metadata and verify ownership
    const file = await env.DB.prepare(
      'SELECT * FROM files WHERE id = ? AND user_id = ?'
    ).bind(fileId, user.id).first();
    
    if (!file) {
      return Response.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Get file from R2
    const object = await env.BUCKET.get(file.r2_key as string);
    
    if (!object) {
      return Response.json({ error: 'File not found in storage' }, { status: 404 });
    }
    
    return new Response(object.body, {
      headers: {
        'Content-Type': file.mime_type as string || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.filename}"`
      }
    });
  }
  
  // POST /api/logout - Logout user
  if (path === '/api/logout' && request.method === 'POST') {
    const user = await authenticate(request, env);
    if (user) {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.substring(7);
      if (token) {
        await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      }
    }
    
    return Response.json({ success: true }, {
      headers: {
        ...corsHeaders(),
        'Set-Cookie': 'session_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
      }
    });
  }
  
  return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() });
}

async function serveFrontend(request: Request, env: Env, path: string): Promise<Response> {
  // Serve HTML pages (create these in public/ folder)
  const htmlPages: Record<string, string> = {
    '/': 'login.html',
    '/dashboard': 'dashboard.html',
    '/files': 'files.html'
  };
  
  const page = htmlPages[path];
  
  if (page) {
    // In production, serve from public folder or generate HTML
    return new Response('Client portal frontend - deploy HTML files', {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  return Response.json({ error: 'Page not found' }, { status: 404 });
}
