// probe-quality.mjs
// 用法: node probe-quality.mjs [--tmdb 1137844] [--concurrency 5] [--timeout 30000]

import VylaSDK from '@vyla-entertainment/sdk';
import { ALL_SOURCES } from './src/sources.js';

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const TMDB_ID = arg('--tmdb', '1137844');
const CONCURRENCY = Number(arg('--concurrency', '5'));
const TIMEOUT = Number(arg('--timeout', '30000'));

const sdk = new VylaSDK();

async function testUrl(url, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': headers?.['User-Agent'] || 'Mozilla/5.0',
        'Referer': headers?.Referer || '',
        'Accept-Encoding': 'identity',
      },
      signal: ctrl.signal,
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    const reader = r.body?.getReader();
    let head = '';
    if (reader) {
      const { value } = await reader.read();
      reader.cancel().catch(() => {});
      if (value) head = new TextDecoder().decode(value.slice(0, 100));
    }
    if (head.startsWith('#EXTM3U')) return { ok: true, type: 'hls' };
    if (head.slice(4, 8) === 'ftyp') return { ok: true, type: 'mp4' };
    return { ok: false, reason: `not media (${head.slice(0, 30)})` };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

async function probeOne(key) {
  const start = Date.now();
  try {
    const r = await Promise.race([
      sdk.getStream(key, TMDB_ID, null, null),
      new Promise((_, rej) => setTimeout(() => rej(new Error('resolve timeout')), TIMEOUT)),
    ]);
    const list = r?.allUrls ? r.allUrls : r ? [r] : [];
    const valid = list.filter(s => s && s.url);
    if (!valid.length) return { key, ok: false, reason: '无流', ms: Date.now() - start };

    // 测每个流
    const tests = await Promise.all(valid.slice(0, 3).map(s => testUrl(s.url, s.headers)));
    const playable = tests.filter(t => t.ok).length;
    return {
      key,
      ok: playable > 0,
      resolveMs: Date.now() - start,
      total: valid.length,
      playable,
      types: [...new Set(tests.filter(t => t.ok).map(t => t.type))],
    };
  } catch (e) {
    return { key, ok: false, reason: e.message, ms: Date.now() - start };
  }
}

async function pool(items, fn, n) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }));
  return results;
}

const results = await pool(ALL_SOURCES, async key => {
  process.stdout.write(`  ${key.padEnd(16)} ... `);
  const r = await probeOne(key);
  if (r.ok) console.log(`✅ ${r.playable}/${r.total} 可播 [${r.types.join(',')}] ${r.resolveMs}ms`);
  else console.log(`❌ ${r.reason}`);
  return r;
}, CONCURRENCY);

const ok = results.filter(r => r.ok);
console.log(`\n✅ 真正可播的源 (${ok.length}/${results.length}):`);
for (const r of ok.sort((a, b) => a.resolveMs - b.resolveMs)) {
  console.log(`  ${r.key.padEnd(16)} ${r.playable}/${r.total} 流  ${r.resolveMs}ms  [${r.types.join(',')}]`);
}

console.log('\n可粘贴到 sources.js 的 DIRECT_SOURCES:');
console.log('[');
for (const r of ok) console.log(`  '${r.key}',`);
console.log(']');