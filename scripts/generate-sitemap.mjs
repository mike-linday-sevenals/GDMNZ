import { SitemapStream, streamToPromise } from 'sitemap';
import { createWriteStream } from 'node:fs';

const hostname = 'https://www.gdmnz.com';

// Add/adjust routes as you ship pages
const routes = [
  '/', '/results', '/features', '/about', '/contact',
  '/sports/fishing', '/sports/rugby', '/sports/netball'
];

const sm = new SitemapStream({ hostname });
for (const url of routes) sm.write({ url, changefreq: 'daily', priority: 0.8 });
sm.end();

const xml = await streamToPromise(sm);
createWriteStream('build/sitemap.xml').write(xml);
console.log('? sitemap.xml written to /build');