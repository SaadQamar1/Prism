import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';

// Deterministically sanitize the preserved upstream runtime for a local-only product.
// Keep the original bundle and upstream source available for attribution and rebuilding.
const original = readFileSync('vendor/miniPaint/dist/bundle.js', 'utf8');
const configSource = readFileSync('vendor/miniPaint/src/js/config.js', 'utf8');
const pixabayKey = configSource.match(/config\.pixabay_key\s*=\s*'([^']+)'/)?.[1];
let bundle = original;
if (pixabayKey) bundle = bundle.replaceAll(pixabayKey, '');
bundle = bundle.replace(/(google_webfonts_key\s*[:=])"[^"]*"(?:\s*\+\s*"[^"]*")?(?:\.replace\([^)]*\))?/g, '$1""');
bundle = bundle.replace(/(pixabay_key\s*[:=])"[^"]*"/g, '$1""');
if (!/pixabay_key\s*[:=]""/.test(bundle) || !/google_webfonts_key\s*[:=]""/.test(bundle)) {
  throw new Error('The upstream credential sanitization needs reviewing before shipping.');
}
mkdirSync('public/editor/dist', { recursive: true });
writeFileSync('public/editor/dist/bundle.js', bundle);
cpSync('vendor/miniPaint/dist/bundle.js.LICENSE.txt', 'public/editor/dist/bundle.js.LICENSE.txt');
mkdirSync('public/licenses/miniPaint-library-sources', { recursive: true });
cpSync('vendor/miniPaint/src/js/libs', 'public/licenses/miniPaint-library-sources', { recursive: true });
cpSync('vendor/miniPaint/MIT-LICENSE.txt', 'public/licenses/miniPaint-MIT.txt');
cpSync('THIRD_PARTY_NOTICES.md', 'public/THIRD_PARTY_NOTICES.md');
cpSync('LICENSE', 'public/LICENSE.txt');
mkdirSync('public/editor/src/js/libs/gifjs', { recursive: true });
cpSync('vendor/miniPaint/src/js/libs/gifjs/gif.worker.js', 'public/editor/src/js/libs/gifjs/gif.worker.js');
console.log('Prepared local editor and retained upstream license notices.');
