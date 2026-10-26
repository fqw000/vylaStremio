// dump-streams.mjs
import VylaSDK from '@vyla-entertainment/sdk';
import { writeFileSync } from 'node:fs';

const TMDB_ID = '1137844';
const SOURCE = 'vidfast';

const sdk = new VylaSDK();
const result = await sdk.getStream(SOURCE, TMDB_ID, null, null);
const list = result.allUrls ? result.allUrls : [result];

// 1. 保存完整 JSON（含所有字段和完整 URL）
writeFileSync('streams.json', JSON.stringify(list, null, 2));

// 2. 保存纯 URL 列表，一行一个，方便 curl 读取
writeFileSync('urls.txt', list.map(s => s.url).join('\n'));

// 3. 只打印第一个的完整 URL 和字段名
console.log('字段名:', Object.keys(list[0]));
console.log('第一个完整 URL:');
console.log(list[0].url);
console.log('\n已写入 streams.json 和 urls.txt');