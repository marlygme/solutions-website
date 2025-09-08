const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const HOST = '0.0.0.0';

// MIME types for common file extensions
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

const server = http.createServer((req, res) => {
  // Add CORS headers and cache control
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  let filePath = req.url === '/' ? '/index.html' : req.url;
  
  // Remove query parameters
  filePath = filePath.split('?')[0];
  
  // Construct full file path
  const fullPath = path.join(__dirname, filePath);
  
  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  // Check if file exists
  fs.access(fullPath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }

    // Read and serve the file
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
});