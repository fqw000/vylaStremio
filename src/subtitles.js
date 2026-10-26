// src/subtitles.js
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0';

async function fetchJson(url, headers = {}) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity', ...headers },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
  return r.json();
}

// ===== 1. Stremio v3 (OpenSubtitles 镜像) =====
async function stremioV3(imdbId, type, season, episode) {
  const params = type === 'series' ? `?season=${season}&episode=${episode}` : '';
  const data = await fetchJson(
    `https://opensubtitles-v3.strem.io/subtitles/${type}/${imdbId}.json${params}`,
    { Referer: 'https://app.strem.io/' }
  );
  return (data.subtitles || []).map(s => ({
    url: s.url,
    lang: s.lang || 'eng',
    label: s.lang || 'Subtitle',
    source: 'v3',
  }));
}

// ===== 2. OpenSubtitles REST (仅英语，补全 v3 可能缺失的英语轨) =====
async function osRest(imdbId, isMovie, season, episode) {
  const bare = String(imdbId).replace(/^tt/, '');
  if (!/^\d+$/.test(bare)) return [];
  let url = 'https://rest.opensubtitles.org/search/';
  if (!isMovie) url += `episode-${episode}/`;
  url += `imdbid-${bare}`;
  if (!isMovie) url += `/season-${season}`;
  url += '/sublanguageid-eng'; // 只搜英语

  const data = await fetchJson(url, { 'X-User-Agent': 'trailers.to-UA' });
  if (!Array.isArray(data)) return [];
  return data
    .filter(item => item.IDSubtitleFile)
    .map(item => ({
      url: `https://dl.opensubtitles.org/en/download/filead/${item.IDSubtitleFile}`,
      lang: 'eng',
      label: item.SubFileName?.replace(/\.srt$/i, '') || 'English',
      source: 'osrest',
    }));
}

// ===== 3. Vidzee (中文优先源) =====
async function vidzee(tmdbId, isMovie, season, episode) {
  const base = isMovie
    ? `https://core.vidzee.wtf/subs/movie/${tmdbId}`
    : `https://core.vidzee.wtf/subs/tv/${tmdbId}/${season}/${episode}`;
  const data = await fetchJson(base);
  if (!Array.isArray(data)) return [];
  return data
    .filter(item => item && item.file)
    .map(item => ({
      url: item.file,
      lang: mapVidzeeLang(item.label),
      label: item.label,
      source: 'vidzee',
    }));
}

function mapVidzeeLang(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('chinese-trad') || l.includes('traditional')) return 'zht';
  if (l.includes('chinese')) return 'zho';
  if (l.includes('english')) return 'eng';
  return l.slice(0, 3);
}

// ===== 4. Trybox (中文补充源，参数做兼容) =====
async function trybox(imdbId, title, year, isMovie, season, episode) {
  // trybox 参数逐步收紧，imdb_id 权重最高
  const params = new URLSearchParams();
  if (imdbId) params.set('imdb_id', imdbId);
  if (title) params.set('title', title);
  if (year) params.set('year', year);
  // 剧集额外参数（推测，trybox 可能支持）
  if (!isMovie && season) params.set('season', season);
  if (!isMovie && episode) params.set('episode', episode);

  let data;
  try {
    data = await fetchJson(`https://trybox.app/api/public/subtitles?${params.toString()}`);
  } catch {
    return [];
  }

  // 兼容多种可能返回格式
  const list = Array.isArray(data) ? data
    : Array.isArray(data?.subtitles) ? data.subtitles
    : Array.isArray(data?.data) ? data.data
    : [];

  return list
    .map(item => {
      const url = item.file || item.url || item.src || '';
      const label = item.label || item.lang || item.language || '';
      if (!url) return null;
      return {
        url,
        lang: mapTryboxLang(label),
        label,
        source: 'trybox',
      };
    })
    .filter(Boolean);
}

function mapTryboxLang(label) {
  const l = String(label || '').toLowerCase();
  if (l.includes('chinese') || l.includes('chi') || l.includes('zh') || l.includes('中')) {
    if (l.includes('trad') || l.includes('繁')) return 'zht';
    return 'zho';
  }
  if (l.includes('english') || l.includes('eng') || l.includes('英')) return 'eng';
  return l.slice(0, 3);
}

// ===== 合并与筛选：仅保留中文 (zho, zht) 和英语 (eng) =====
const KEEP_LANGS = new Set(['zho', 'zht', 'chi', 'eng']); // chi 是部分源对中文的标记
const LANG_RANK = { zho: 0, zht: 1, chi: 0, eng: 2 };

// const KEEP_LANGS = new Set(['zho', 'zht', 'eng']);
// const LANG_RANK = { zho: 0, zht: 1, eng: 2 };
const MAX_PER_LANG = 2; // 每种语言最多保留几条

function curate(subs) {
  const byLang = new Map();

  for (const s of subs) {
    if (!s.url || !s.lang) continue;
    const lang = s.lang.toLowerCase();
    if (!KEEP_LANGS.has(lang)) continue;

    if (!byLang.has(lang)) byLang.set(lang, []);
    const list = byLang.get(lang);

    // 同语言去重，优先 UTF-8
    const isUtf8 = !s.url.includes('senc=');
    const existingIdx = list.findIndex(x => x.url === s.url);
    if (existingIdx >= 0) {
      if (isUtf8 && list[existingIdx].url.includes('senc=')) list[existingIdx] = { ...s, lang };
      continue;
    }

    if (list.length < MAX_PER_LANG) list.push({ ...s, lang });
  }

  // 展平并按语言排序
  const result = [];
  for (const lang of ['zho', 'zht', 'eng']) {
    const list = byLang.get(lang) || [];
    for (let i = 0; i < list.length; i++) {
      result.push({
        ...list[i],
        // id 必须唯一，加入来源和序号
        id: `sub-${lang}-${list[i].source || 'unknown'}-${i}`,
        // label 显示语言 + 来源，便于用户区分
        label: `${list[i].label || lang} (${list[i].source || 'unknown'}${i > 0 ? ` #${i + 1}` : ''})`,
      });
    }
  }
  return result;
}

// ===== 导出：汇总所有源 =====
export async function resolveSubtitles(imdbId, type, season, episode, tmdbId, title, year, subtitleLang = 'both') {
  const isMovie = type === 'movie';

  const tasks = [
    stremioV3(imdbId, type, season, episode),
    osRest(imdbId, isMovie, season, episode),
    vidzee(tmdbId, isMovie, season, episode),
    trybox(imdbId, title, year, isMovie, season, episode),
  ];

  const results = await Promise.allSettled(tasks);

  const merged = [];
  const seen = new Set();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const s of r.value) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      merged.push(s);
    }
  }


  const curated = curate(merged);
  // 根据 subtitleLang 过滤
  if (subtitleLang === 'zho') {
    return curated.filter(s => s.lang === 'zho' || s.lang === 'zht');
  }
  if (subtitleLang === 'eng') {
    return curated.filter(s => s.lang === 'eng');
  }
  return curated; // 'both'

}