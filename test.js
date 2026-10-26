// probe-streams.mjs
// 从 SDK 动态拉取所有源，逐个测试 getStream
// 用法:
//   node probe-streams.mjs                     # 默认 Mayday (TMDB 1137844, 电影)
//   node probe-streams.mjs --tmdb 1399 --tv 1 1  # 权游 S1E1
//   node probe-streams.mjs --concurrency 5      # 并发数（默认 5）
//   node probe-streams.mjs --timeout 30000      # 单源超时（默认 30s）

import VylaSDK from '@vyla-entertainment/sdk';

// ===== 参数 =====
function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const TMDB_ID = arg('--tmdb', '1137844');
const SEASON = arg('--tv', null) ? process.argv[process.argv.indexOf('--tv') + 1] : null;
const EPISODE = arg('--tv', null) ? process.argv[process.argv.indexOf('--tv') + 2] : null;
const CONCURRENCY = Number(arg('--concurrency', '5'));
const TIMEOUT_MS = Number(arg('--timeout', '30000'));
const IS_TV = !!SEASON;

const sdk = new VylaSDK();

// ===== 单源探测（带超时） =====
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)
    ),
  ]);
}

async function probeOne(key) {
  const start = Date.now();
  try {
    const r = await withTimeout(
      sdk.getStream(
        key,
        TMDB_ID,
        IS_TV ? Number(SEASON) : null,
        IS_TV ? Number(EPISODE) : null
      ),
      TIMEOUT_MS,
      key
    );
    const list = r.allUrls ? r.allUrls : [r];
    const valid = list.filter(x => x && x.url);
    return {
      key,
      ok: valid.length > 0,
      count: valid.length,
      ms: Date.now() - start,
      sample: valid[0]?.url?.slice(0, 80) || null,
    };
  } catch (e) {
    return {
      key,
      ok: false,
      error: (e.message || String(e)).slice(0, 80),
      ms: Date.now() - start,
    };
  }
}

// ===== 并发池 =====
async function pool(items, fn, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ===== 主流程 =====
async function main() {
  const all = sdk.getSources();
  const keys = all.map(s => s.key);

  console.log('='.repeat(70));
  console.log(`测试目标: TMDB ${TMDB_ID}${IS_TV ? ` S${SEASON}E${EPISODE}` : ' (电影)'}`);
  console.log(`源总数: ${keys.length}  |  并发: ${CONCURRENCY}  |  单源超时: ${TIMEOUT_MS}ms`);
  console.log('='.repeat(70));

  const start = Date.now();
  const results = await pool(keys, async (key) => {
    process.stdout.write(`  ${key.padEnd(18)} ... `);
    const r = await probeOne(key);
    if (r.ok) {
      console.log(`✅ ${r.count} 个流  ${r.ms}ms`);
    } else if (r.error) {
      console.log(`❌ ${r.error}  ${r.ms}ms`);
    } else {
      console.log(`⚠️ 无流  ${r.ms}ms`);
    }
    return r;
  }, CONCURRENCY);

  const totalMs = Date.now() - start;

  // ===== 汇总 =====
  const ok = results.filter(r => r.ok);
  const empty = results.filter(r => !r.ok && !r.error);
  const fail = results.filter(r => !r.ok && r.error);

  console.log('\n' + '='.repeat(70));
  console.log('汇总');
  console.log('='.repeat(70));
  console.log(`✅ 可用: ${ok.length}  ${ok.map(r => r.key).join(', ') || '(无)'}`);
  console.log(`⚠️ 无流: ${empty.length}  ${empty.map(r => r.key).join(', ') || '(无)'}`);
  console.log(`❌ 失败: ${fail.length}`);
  for (const r of fail) {
    console.log(`   - ${r.key.padEnd(18)} ${r.error}`);
  }
  console.log(`\n总耗时: ${(totalMs / 1000).toFixed(1)}s`);

  // ===== 可直接粘贴到 resolver.js 的数组 =====
  if (ok.length) {
    console.log('\n' + '='.repeat(70));
    console.log('可用源（按响应速度排序，可直接放入 SOURCES）:');
    console.log('='.repeat(70));
    const sorted = ok.sort((a, b) => a.ms - b.ms);
    console.log('const SOURCES = [');
    for (const r of sorted) {
      console.log(`  '${r.key}',  // ${r.count} 个流, ${r.ms}ms`);
    }
    console.log('];');
  }

  // ===== 可用源的样本 URL（验证用） =====
  if (ok.length) {
    console.log('\n可用源样本 URL（前 3 个）:');
    for (const r of ok.slice(0, 3)) {
      if (r.sample) console.log(`  ${r.key}: ${r.sample}...`);
    }
  }
}

main().catch(e => {
  console.error('❌ 未捕获错误:', e);
  process.exit(1);
});