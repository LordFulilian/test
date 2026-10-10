const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../build-config.json');
if (!/^[a-z0-9-]+$/.test(config.outputName)) throw new Error('Unsafe build output name');
const root = path.resolve(__dirname, '../build', config.outputName);
const port = Number(process.argv[2] || 7456);
if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('Run npm run build first: Creator build is missing.');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.wasm': 'application/wasm', '.map': 'application/json' };
http.createServer((req, res) => {
    let relative;
    try { relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
    let servedRoot = root;
    if(config.s4Testing){
        const match=relative.match(/^\/(20|30)(\/|$)/);
        if(match){if(relative===`/${match[1]}`){res.writeHead(302,{Location:`/${match[1]}/`});res.end();return;}
            servedRoot=path.resolve(__dirname,'../build','s4-'+match[1]);relative=relative.slice(match[1].length+1);}
    }
    const file = path.resolve(servedRoot, '.' + relative, relative.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(servedRoot + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (error, content) => { if (error) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content); });
}).listen(port, '127.0.0.1', () => console.log(`Cocos ${config.outputName}: http://127.0.0.1:${port}/`));
