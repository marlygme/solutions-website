const http = require('http');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const db = require('./portal-db');

const PORT = 5000;
const HOST = '0.0.0.0';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      cookies[name] = value;
    });
  }
  return cookies;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies.portal_session;
  if (sessionToken) {
    return db.getSessionUser(sessionToken);
  }
  return null;
}

async function handleAPI(req, res, pathname) {
  if (pathname === '/api/portal/request-code' && req.method === 'POST') {
    const body = await parseBody(req);
    const email = body.email?.toLowerCase().trim();
    
    if (!email || !email.includes('@')) {
      return sendJSON(res, 400, { error: 'Invalid email address' });
    }
    
    const code = db.createLoginCode(email);
    
    if (IS_DEVELOPMENT) {
      console.log(`\n=================================`);
      console.log(`LOGIN CODE FOR ${email}: ${code}`);
      console.log(`=================================\n`);
    }
    
    sendJSON(res, 200, { 
      success: true, 
      message: IS_DEVELOPMENT 
        ? 'Login code sent. Check the server console for your code (email integration coming soon).'
        : 'Login code sent to your email address.'
    });
    return true;
  }
  
  if (pathname === '/api/portal/verify-code' && req.method === 'POST') {
    const body = await parseBody(req);
    const email = body.email?.toLowerCase().trim();
    const code = body.code?.trim();
    
    if (!email || !code) {
      return sendJSON(res, 400, { error: 'Email and code required' });
    }
    
    if (db.verifyLoginCode(email, code)) {
      const user = db.getOrCreateUser(email);
      const sessionToken = db.createSession(user.id);
      
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Set-Cookie': `portal_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end(JSON.stringify({ success: true }));
    } else {
      sendJSON(res, 401, { error: 'Invalid or expired code' });
    }
    return true;
  }
  
  if (pathname === '/api/portal/logout' && req.method === 'POST') {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies.portal_session;
    if (sessionToken) {
      db.deleteSession(sessionToken);
    }
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Set-Cookie': 'portal_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ success: true }));
    return true;
  }
  
  if (pathname === '/api/portal/dashboard' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJSON(res, 401, { error: 'Unauthorized' });
    }
    
    const stats = db.getUserStats(user.id);
    
    sendJSON(res, 200, {
      email: user.email,
      fileCount: stats.fileCount,
      lastUpload: stats.lastUpload ? new Date(stats.lastUpload).toLocaleDateString() : null,
      storageUsed: formatBytes(stats.totalSize)
    });
    return true;
  }
  
  if (pathname === '/api/portal/files' && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJSON(res, 401, { error: 'Unauthorized' });
    }
    
    const files = db.getUserFiles(user.id);
    sendJSON(res, 200, { email: user.email, files });
    return true;
  }
  
  if (pathname === '/api/portal/upload' && req.method === 'POST') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJSON(res, 401, { error: 'Unauthorized' });
    }
    
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024
    });
    
    form.parse(req, (err, fields, files) => {
      if (err) {
        return sendJSON(res, 500, { error: 'Upload failed' });
      }
      
      const file = files.file;
      if (!file) {
        return sendJSON(res, 400, { error: 'No file uploaded' });
      }
      
      const fileData = Array.isArray(file) ? file[0] : file;
      const filename = fileData.originalFilename || 'unnamed';
      const filepath = fileData.filepath;
      const size = fileData.size;
      
      const fileId = db.addFile(user.id, filename, filepath, size);
      
      sendJSON(res, 200, { success: true, fileId });
    });
    return true;
  }
  
  if (pathname.startsWith('/api/portal/download/') && req.method === 'GET') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJSON(res, 401, { error: 'Unauthorized' });
    }
    
    const fileId = parseInt(pathname.split('/').pop());
    const file = db.getFile(fileId, user.id);
    
    if (!file) {
      return sendJSON(res, 404, { error: 'File not found' });
    }
    
    const filePath = file.filepath;
    if (!fs.existsSync(filePath)) {
      return sendJSON(res, 404, { error: 'File not found on disk' });
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.size
    });
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    return true;
  }
  
  if (pathname.startsWith('/api/portal/delete/') && req.method === 'DELETE') {
    const user = getSessionUser(req);
    if (!user) {
      return sendJSON(res, 401, { error: 'Unauthorized' });
    }
    
    const fileId = parseInt(pathname.split('/').pop());
    const file = db.deleteFile(fileId, user.id);
    
    if (!file) {
      return sendJSON(res, 404, { error: 'File not found' });
    }
    
    try {
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
    
    sendJSON(res, 200, { success: true });
    return true;
  }
  
  return false;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let pathname = req.url.split('?')[0];
  
  if (pathname.startsWith('/api/')) {
    const handled = await handleAPI(req, res, pathname);
    if (handled) return;
  }
  
  if (pathname.startsWith('/portal')) {
    if (pathname === '/portal' || pathname === '/portal/') {
      pathname = '/portal/login.html';
    } else if (pathname === '/portal/login') {
      pathname = '/portal/login.html';
    } else if (pathname === '/portal/dashboard') {
      const user = getSessionUser(req);
      if (!user) {
        res.writeHead(302, { 'Location': '/portal/login' });
        res.end();
        return;
      }
      pathname = '/portal/dashboard.html';
    } else if (pathname === '/portal/files') {
      const user = getSessionUser(req);
      if (!user) {
        res.writeHead(302, { 'Location': '/portal/login' });
        res.end();
        return;
      }
      pathname = '/portal/files.html';
    }
  }
  
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 - Internal Server Error</h1>');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log(`Serving static files from: ${__dirname}`);
  console.log(`Portal available at: http://${HOST}:${PORT}/portal`);
});
