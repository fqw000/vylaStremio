// 使用probe-source.js对VylaSDK的sdk.getSource的源列表进行测试以后分类

// 直连可用源（普通网络可解析）
export const DIRECT_SOURCES = [
  '111477', 'bcine', 'cinemaarmy', 'cinesrc', 'cinezo',
  'flaxmovies', 'hexa', 'hyper', 'net79', 'rivestream',
  'thugtv', 'vidapi', 'vidzee', 'watchout',
];



// 需要代理的源
export const PROXY_SOURCES = [
  'hexa', 'cno', 'dulo', 'pstream', 'vidcore', 'vidfast', 'vidlink',
];

export const ALL_SOURCES = [...DIRECT_SOURCES, ...PROXY_SOURCES];

export function getDefaultConfig() {
  return {
    sources: [...ALL_SOURCES], // 默认全开
    testStreams: true,         // 默认测试真实可用性
        subtitleLang: 'both',   // 'zho' | 'eng' | 'both'
    stripIpBound: true,          // 剔除 IP 绑定 URL
  };
}
