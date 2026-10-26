import express from 'express';
import cors from 'cors'; // 🆕 引入 cors
import path from 'path';
import { fileURLToPath } from 'url';
import { parseStremioId, getMeta } from './src/ids.js';
import { resolveStream } from './src/resolver.js';
import { resolveSubtitles } from './src/subtitles.js';
import { ALL_SOURCES, getDefaultConfig } from './src/sources.js';
import { renderConfigurePage } from './src/configure.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 7001;

// 🆕 开启 CORS，允许 Stremio 跨域请求
app.use(cors());

// 静态文件（favicon）
app.use(express.static(path.join(__dirname, 'public')));

function parseConfig(encoded) {
  if (!encoded || encoded === 'default') return getDefaultConfig();
  try {
    // 🆕 配合前端 btoa(encodeURIComponent()) 的解析
    const json = decodeURIComponent(Buffer.from(encoded, 'base64url').toString('utf8'));
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed.sources)) {
      return {
        sources: parsed.sources.filter(s => ALL_SOURCES.includes(s)),
        testStreams: parsed.testStreams !== false,
        stripIpBound: parsed.stripIpBound !== false,
        subtitleLang: ['zho', 'eng', 'both'].includes(parsed.subtitleLang) ? parsed.subtitleLang : 'both',
      };
    }
  } catch (e) {
    console.error('Config parse error:', e.message);
  }
  return getDefaultConfig();
}

function buildManifest(config) {
  return {
    id: 'org.vyla.stremio',
    version: '1.2.0',
    name: 'Vyla Multi-Source',
    description: `Vyla 多源（${config.sources.length} 个源）+ 中英字幕`,
    resources: ['stream', 'subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: [],
    behaviorHints: { configurable: true },
  };
}

async function handleStream(type, id, config) {
  const { imdbId, season, episode } = parseStremioId(id);
  const meta = await getMeta(imdbId, type);
  if (!meta?.tmdbId) return { streams: [] };

  let streams;
  try {
    streams = await resolveStream(meta.tmdbId, type === 'movie', season, episode, config);
  } catch (e) {
    console.error(`[stream] ${e.message}`);
    return { streams: [] };
  }

  console.log(`[stream] ${imdbId} → ${streams.length} 个可用流（IP剔除=${config.stripIpBound}，测试=${config.testStreams}）`);
  return {
    streams: streams.map((s, i) => ({
      name: `${s.source} ${i + 1}`,
      title: `${s.source}${s.test?.type ? ` (${s.test.type})` : ''}`,
      url: s.url,
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: {
          request: {
            'Referer': s.headers?.Referer || '',
            'User-Agent': s.headers?.['User-Agent'] || 'Mozilla/5.0',
          },
        },
      },
    })),
  };
}

async function handleSubtitles(type, id, config) {
  const { imdbId, season, episode } = parseStremioId(id);
  const meta = await getMeta(imdbId, type);
  try {
    const subs = await resolveSubtitles(
      imdbId, type, season, episode,
      meta?.tmdbId, meta?.title, meta?.year,
      config.subtitleLang
    );
    return { subtitles: subs.map(s => ({ id: s.id, url: s.url, lang: s.lang })) };
  } catch (e) {
    console.error(`[subtitles] ${e.message}`);
    return { subtitles: [] };
  }
}

// ===== 路由 =====
app.get('/configure', (req, res) => {
  res.type('html').send(renderConfigurePage(getDefaultConfig()));
});

app.get('/manifest.json', (req, res) => res.json(buildManifest(parseConfig(null))));
app.get('/:config/manifest.json', (req, res) => res.json(buildManifest(parseConfig(req.params.config))));

app.get('/stream/:type/:id.json', async (req, res) =>
  res.json(await handleStream(req.params.type, req.params.id, parseConfig(null))));
app.get('/:config/stream/:type/:id.json', async (req, res) =>
  res.json(await handleStream(req.params.type, req.params.id, parseConfig(req.params.config))));

app.get('/subtitles/:type/:id.json', async (req, res) =>
  res.json(await handleSubtitles(req.params.type, req.params.id, parseConfig(null))));
app.get('/:config/subtitles/:type/:id.json', async (req, res) =>
  res.json(await handleSubtitles(req.params.type, req.params.id, parseConfig(req.params.config))));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Addon 已启动`);
  console.log(`   配置页: http://127.0.0.1:${PORT}/configure`);
  console.log(`   Manifest: http://127.0.0.1:${PORT}/manifest.json`);
});