import { DIRECT_SOURCES, PROXY_SOURCES, ALL_SOURCES } from './sources.js';

export function renderConfigurePage(defaultConfig) {
  const selected = new Set(defaultConfig.sources || ALL_SOURCES);
  const subLang = defaultConfig.subtitleLang || 'both';
  const stripIp = defaultConfig.stripIpBound !== false;
  const testStreams = defaultConfig.testStreams !== false;

  const renderSource = (key) => `
    <label class="checkbox-item">
      <input type="checkbox" class="config-input" value="${key}" ${selected.has(key) ? 'checked' : ''}>
      <span class="custom-check"></span>
      <span class="label-text">${key}</span>
    </label>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Vyla Addon 配置</title>
<link rel="icon" href="/favicon.ico">
<style>
  :root {
    --bg: #f5f6f8;
    --card-bg: #ffffff;
    --text-main: #111827;
    --text-sub: #6b7280;
    --primary: #3b82f6;
    --border: #e5e7eb;
    --radius: 16px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text-main);
    min-height: 100vh;
    padding: 40px 20px 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .container {
    width: 100%;
    max-width: 800px;
  }
  
  /* 顶部 Logo 和标题 */
  .header {
    text-align: center;
    margin-bottom: 40px;
  }
  .header img {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    margin-bottom: 16px;
    object-fit: contain;
  }
  .header h1 {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-sub);
  }

  /* 分区标题 */
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 8px;
    padding-left: 4px;
  }
  .section-desc {
    font-size: 13px;
    color: var(--text-sub);
    margin-bottom: 16px;
    padding-left: 4px;
  }

  /* 卡片容器 */
  .card {
    background: var(--card-bg);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }

  /* 网格复选框 (用于源选择) */
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 16px;
  }
  .checkbox-item {
    display: flex;
    align-items: center;
    cursor: pointer;
    user-select: none;
    font-size: 15px;
  }
  .checkbox-item input {
    display: none;
  }
  .custom-check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid #d1d5db;
    margin-right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .checkbox-item input:checked + .custom-check {
    background: var(--primary);
    border-color: var(--primary);
  }
  .checkbox-item input:checked + .custom-check::after {
    content: "";
    width: 6px;
    height: 12px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-bottom: 2px;
  }
  .label-text {
    color: #374151;
  }

  /* 开关行 */
  .switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }
  .switch-row + .switch-row {
    margin-top: 16px;
    border-top: 1px solid var(--border);
    padding-top: 20px;
  }
  .switch-info .title {
    font-size: 15px;
    font-weight: 500;
    color: var(--text-main);
    margin-bottom: 4px;
  }
  .switch-info .desc {
    font-size: 13px;
    color: var(--text-sub);
  }

  /* iOS 风格开关 */
  .switch {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 30px;
    flex-shrink: 0;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: #e5e7eb;
    transition: .3s;
    border-radius: 30px;
  }
  .slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  input:checked + .slider {
    background-color: var(--primary);
  }
  input:checked + .slider:before {
    transform: translateX(20px);
  }

  /* 下拉选择行 */
  .select-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }
  .select-row .title {
    font-size: 15px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .select-row .desc {
    font-size: 13px;
    color: var(--text-sub);
  }
  select {
    appearance: none;
    background: #f9fafb;
    border: 1px solid var(--border);
    padding: 10px 36px 10px 16px;
    border-radius: 10px;
    font-size: 15px;
    color: var(--text-main);
    cursor: pointer;
    outline: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
  }
  select:focus {
    border-color: var(--primary);
  }

  /* 配置摘要与复制 */
  .summary-label {
    font-size: 14px;
    font-weight: 500;
    color: #4b5563;
    margin-bottom: 12px;
  }
  .url-box {
    background: #f3f4f6;
    padding: 16px;
    border-radius: 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    color: #374151;
    word-break: break-all;
    margin-bottom: 12px;
    line-height: 1.6;
  }
  .copy-btn {
    width: 100%;
    background: #ffffff;
    color: var(--primary);
    border: 1px solid var(--primary);
    padding: 12px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .copy-btn:hover {
    background: #eff6ff;
  }

  /* 底部悬浮安装按钮 */
  .footer {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 24px 20px;
    background: linear-gradient(to top, rgba(245,246,248,1) 60%, rgba(245,246,248,0));
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 10;
  }
  .install-btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: 16px 40px;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(59,130,246,0.3);
    transition: transform 0.2s, box-shadow 0.2s;
    width: 100%;
    max-width: 320px;
  }
  .install-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(59,130,246,0.4);
  }
  .domain-text {
    margin-top: 16px;
    font-size: 13px;
    color: #9ca3af;
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <img src="/favicon.ico" alt="Logo" onerror="this.style.display='none'">
    <h1>@vyla-entertainment/sd</h1>
  </div>

  <!-- 功能开关 -->
  <div class="section-title">功能开关</div>
  <div class="card" style="display:flex; justify-content:center; flex-wrap:wrap; gap:16px;">
    <label class="checkbox-item">
      <input type="checkbox" checked disabled>
      <span class="custom-check"></span>
      <span class="label-text">Stream 播放</span>
    </label>
    <label class="checkbox-item">
      <input type="checkbox" checked disabled>
      <span class="custom-check"></span>
      <span class="label-text">Subtitle 字幕</span>
    </label>
  </div>

  <!-- 直连源 -->
  <div class="section-title">直连源</div>
  <div class="section-desc">普通网络环境下可解析（基于实测）</div>
  <div class="card">
    <div class="grid-container">
      ${DIRECT_SOURCES.map(k => renderSource(k)).join('')}
    </div>
  </div>

  <!-- 代理源 -->
  <div class="section-title">代理源</div>
  <div class="section-desc">需要代理或特殊网络才能解析</div>
  <div class="card">
    <div class="grid-container">
      ${PROXY_SOURCES.map(k => renderSource(k)).join('')}
    </div>
  </div>

  <!-- 播放优化 -->
  <div class="section-title">播放优化</div>
  <div class="card">
    <div class="switch-row">
      <div class="switch-info">
        <div class="title">剔除 IP 绑定 URL</div>
        <div class="desc">过滤含 IP 参数的流链接，避免跨设备 403</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="stripIp" class="config-input" ${stripIp ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
    <div class="switch-row">
      <div class="switch-info">
        <div class="title">测试流真实可用性</div>
        <div class="desc">解析后实测 streamUrl，过滤无法播放的源</div>
      </div>
      <label class="switch">
        <input type="checkbox" id="testStreams" class="config-input" ${testStreams ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  </div>

  <!-- 字幕语言 -->
  <div class="section-title">字幕语言</div>
  <div class="card">
    <div class="select-row">
      <div>
        <div class="title">首选语言</div>
        <div class="desc">播放器默认加载的字幕</div>
      </div>
      <select id="subtitleLang" class="config-input">
        <option value="both" ${subLang === 'both' ? 'selected' : ''}>中英文</option>
        <option value="zho" ${subLang === 'zho' ? 'selected' : ''}>中文</option>
        <option value="eng" ${subLang === 'eng' ? 'selected' : ''}>英文</option>
      </select>
    </div>
  </div>

  <!-- 配置摘要 (常显) -->
  <div class="section-title" style="margin-top: 16px;">配置摘要</div>
  <div class="card">
    <div class="summary-label">安装地址</div>
    <div class="url-box" id="installUrlText">生成中...</div>
    <button class="copy-btn" onclick="copyUrl()">复制链接</button>
  </div>

</div>

<!-- 底部悬浮安装按钮 -->
<div class="footer">
  <button class="install-btn" onclick="installToStremio()">安装到 Stremio</button>
  <div class="domain-text">wangqifei.eu.org</div>
</div>

<script>
let currentInstallUrl = '';

function updateUrl() {
  const sources = [...document.querySelectorAll('input[type="checkbox"]:checked:not([disabled])')].map(e => e.value);
  
  // 如果用户把所有源都取消了，URL 也保持更新，只是提示一下
  const config = {
    sources,
    testStreams: document.getElementById('testStreams').checked,
    stripIpBound: document.getElementById('stripIp').checked,
    subtitleLang: document.getElementById('subtitleLang').value,
  };
  
  const encoded = btoa(encodeURIComponent(JSON.stringify(config)))
    .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    
  currentInstallUrl = location.origin + '/' + encoded + '/manifest.json';
  document.getElementById('installUrlText').textContent = currentInstallUrl;
}

function copyUrl() {
  if (!currentInstallUrl) return;
  navigator.clipboard.writeText(currentInstallUrl).then(() => {
    alert('安装链接已复制到剪贴板！');
  }).catch(() => {
    prompt('请手动复制此链接：', currentInstallUrl);
  });
}

function installToStremio() {
  if (!currentInstallUrl) return;
  const stremioUrl = 'stremio://' + currentInstallUrl.replace(/^https?:\\/\\//, '');
  window.location.href = stremioUrl;
}

// 绑定所有输入的 change 事件，实现实时更新
document.querySelectorAll('.config-input').forEach(el => {
  el.addEventListener('change', updateUrl);
});

// 页面加载时初始化一次
updateUrl();
</script>
</body>
</html>`;
}