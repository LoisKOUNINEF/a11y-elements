// Serves the built `dist/` and the e2e page for the Playwright smoke suite — no dependency needed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.PORT ?? 4173);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  // Only the built bundle and the e2e page are served.
  if (!/^\/(dist|e2e)\//.test(path)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, () => console.log(`e2e server on http://localhost:${port}`));
