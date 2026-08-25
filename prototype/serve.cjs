const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'prototype/icon-card-shell-options.html';
  const target = path.resolve(root, relative);
  if (!target.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8124, '127.0.0.1');
