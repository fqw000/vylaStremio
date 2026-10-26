import VylaSDK from '@vyla-entertainment/sdk';
import { ALL_SOURCES } from './sources.js';

const sdk = new VylaSDK();
const streamCache = new Map();
const CACHE_TTL = 60_000;
const STREAM_TEST_TIMEOUT = 8_000;

// ===== IP 检测 =====
const IPV4_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
const IPV6_RE = /\[?[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{1,4}){2,7}\]?/;

function isIpBound(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname;
    // 纯 IP hostname（IPv4 或 IPv6）
    if (IPV4_RE.test(host) || IPV6_RE.test(host)) return true;
    // URL 参数或路径中出现 IPv4/IPv6 字面量（常见于鉴权参数）
    const full = u.href;
    if (IPV4_RE.test(full)) return true;
    if (IPV6_RE.test(full) && full.includes(':')) return true;
  } catch {}
  return false;
}

// ===== 流可用性测试 =====
async function testStreamUrl(url, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STREAM_TEST_TIMEOUT);
  const started = Date.now();
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
    const ms = Date.now() - started;
    if (!r.ok) return { ok: false, status: r.status, ms, reason: `HTTP ${r.status}` };

    const reader = r.body?.getReader();
    let head = '';
    if (reader) {
      const { value } = await reader.read();
      reader.cancel().catch(() => {});
      if (value) head = new TextDecoder().decode(value.slice(0, 200));
    } else {
      head = (await r.text()).slice(0, 200);
    }
    const isM3u8 = head.startsWith('#EXTM3U');
    const isMp4 = head.length >= 8 && head.slice(4, 8) === 'ftyp';
    return {
      ok: isM3u8 || isMp4,
      status: r.status,
      ms,
      type: isM3u8 ? 'hls' : isMp4 ? 'mp4' : 'unknown',
      reason: isM3u8 || isMp4 ? null : `not media`,
    };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - started,
      reason: e.name === 'AbortError' ? 'timeout' : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ===== 单源解析 =====
async function resolveOneSource(key, tmdbId, isMovie, season, episode) {
  try {
    const result = await sdk.getStream(
      key,
      tmdbId,
      isMovie ? null : Number(season),
      isMovie ? null : Number(episode)
    );
    const list = result?.allUrls ? result.allUrls : result ? [result] : [];
    return list
      .filter(s => s && s.url)
      .map(s => ({
        url: s.url,
        headers: s.headers || {},
        source: key,
      }));
  } catch {
    return [];
  }
}

// ===== 主入口 =====
export async function resolveStream(tmdbId, isMovie, season, episode, config = {}) {
  const enabled = Array.isArray(config.sources) && config.sources.length
    ? config.sources.filter(k => ALL_SOURCES.includes(k))
    : ALL_SOURCES;
  const shouldTest = config.testStreams !== false;
  const shouldStripIp = config.stripIpBound !== false;

  const cacheKey = `${tmdbId}:${isMovie}:${season}:${episode}:${enabled.join(',')}:${shouldTest}:${shouldStripIp}`;
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const perSource = await Promise.allSettled(
    enabled.map(key => resolveOneSource(key, tmdbId, isMovie, season, episode))
  );

  const seen = new Set();
  let streams = [];
  for (const r of perSource) {
    if (r.status !== 'fulfilled') continue;
    for (const s of r.value) {
      if (!s.url || seen.has(s.url)) continue;
      // IP 剔除（在测试前执行，节省时间）
      if (shouldStripIp && isIpBound(s.url)) {
        console.log(`[strip] IP 绑定剔除: ${s.url.slice(0, 80)}`);
        continue;
      }
      seen.add(s.url);
      streams.push(s);
    }
  }

  if (shouldTest && streams.length) {
    const tested = await Promise.allSettled(
      streams.map(async s => {
        const test = await testStreamUrl(s.url, s.headers);
        return { ...s, test };
      })
    );
    streams = tested
      .filter(r => r.status === 'fulfilled' && r.value.test.ok)
      .map(r => r.value);
  }

  // 每源最多 3 个
  const perSourceMap = new Map();
  for (const s of streams) {
    if (!perSourceMap.has(s.source)) perSourceMap.set(s.source, []);
    const list = perSourceMap.get(s.source);
    if (list.length < 3) list.push(s);
  }
  const final = [];
  for (const list of perSourceMap.values()) final.push(...list);

  streamCache.set(cacheKey, { data: final, at: Date.now() });
  return final;
}