// src/ids.js
const CINEMETA = 'https://v3-cinemeta.strem.io';
const cache = new Map();

export function parseStremioId(id) {
  const [imdbId, season, episode] = String(id).split(':');
  return { imdbId, season: season || '1', episode: episode || '1' };
}

// 返回 { tmdbId, title, year }，失败返回 null
export async function getMeta(imdbId, type) {
  const key = `${type}:${imdbId}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const r = await fetch(`${CINEMETA}/meta/${type}/${imdbId}.json`);
    if (!r.ok) return null;
    const meta = (await r.json())?.meta;
    if (!meta) return null;
    const result = {
      tmdbId: meta.moviedb_id || null,
      title: meta.name || null,
      year: meta.year || (meta.releaseInfo ? String(meta.releaseInfo).slice(0, 4) : null),
    };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}