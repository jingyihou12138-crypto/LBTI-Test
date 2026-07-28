// 页面装配冒烟测试：模拟浏览器脚本加载顺序 + DOM id 校验 + 省市数据完整性 + 数据集坐标回归
// 运行：node 人设测试网页/脚本/verify_page.mjs
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let fail = 0;

// 1. 浏览器模式加载 astronomy + cities + logic（无 module，全局挂载）
const sandbox = { console };
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('astronomy.browser.min.js'), sandbox, { filename: 'astronomy.browser.min.js' });
if (typeof sandbox.Astronomy !== 'object') { console.log('!! astronomy 库未挂载全局 Astronomy'); fail++; }
vm.runInContext(read('cities.js'), sandbox, { filename: 'cities.js' });
vm.runInContext(read('logic.js'), sandbox, { filename: 'logic.js' });
const L = sandbox.PersonaLogic;
const CD = sandbox.CityData;
if (!L || typeof L.computeResult !== 'function') { console.log('!! logic.js 浏览器模式未挂载 PersonaLogic'); fail++; }
if (!CD || !Array.isArray(CD.PROVINCES)) { console.log('!! cities.js 浏览器模式未挂载 CityData'); fail++; }

// 2. 省市数据完整性
if (CD) {
  const provs = CD.PROVINCES;
  const domestic = provs.filter(p => p.name !== '海外/其他');
  if (domestic.length !== 34) { console.log('!! 省级行政区数 =', domestic.length, '应为 34'); fail++; }
  let cityCount = 0;
  const seen = new Set();
  for (const p of provs) {
    if (!p.cities || p.cities.length < 1) { console.log('!! 省份无城市:', p.name); fail++; continue; }
    for (const c of p.cities) {
      cityCount++;
      const [name, lat, lng] = c;
      if (typeof name !== 'string' || !name) { console.log('!! 城市名异常:', p.name, JSON.stringify(c)); fail++; }
      if (seen.has(p.name + '/' + name)) { console.log('!! 城市重复:', p.name, name); fail++; }
      seen.add(p.name + '/' + name);
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) { console.log('!! 经纬度非数字:', p.name, name); fail++; continue; }
      if (p.name === '海外/其他') {
        if (Math.abs(lat) > 60 || Math.abs(lng) > 180) { console.log('!! 海外经纬度越界:', name, lat, lng); fail++; }
      } else {
        // 中国境内范围（含台湾/南海诸岛）
        if (lat < 3 || lat > 54 || lng < 73 || lng > 136) { console.log('!! 境内经纬度越界:', p.name, name, lat, lng); fail++; }
        const tz = c[3];
        if (tz && tz !== 'Asia/Shanghai') { console.log('!! 境内时区异常:', p.name, name, tz); fail++; }
      }
    }
  }
  const hebei = provs.find(p => p.name === '河北省');
  const tsIdx = hebei ? hebei.cities.findIndex(c => c[0] === '唐山市') : -1;
  if (tsIdx < 0) { console.log('!! 河北省下找不到唐山市'); fail++; }
  const overseas = provs.find(p => p.name === '海外/其他');
  if (!overseas || !overseas.cities.some(c => c[0] === '首尔')) { console.log('!! 海外分组缺首尔'); fail++; }
  console.log(`省市数据: ${domestic.length} 个省级行政区 / 共 ${cityCount} 个城市条目, 完整性 ${fail === 0 ? 'OK' : '有问题'}`);
}

// 3. 三个回归案例：用「省市联动数据集」里的坐标跑端到端
if (L && CD) {
  const pick = (prov, city) => {
    const pi = CD.PROVINCES.findIndex(p => p.name === prov);
    const ci = CD.PROVINCES[pi].cities.findIndex(c => c[0] === city);
    return CD.getCity(pi, ci);
  };
  const cases = [
    { mbti: 'ENFP', d: [2002, 12, 5, 7, 5], loc: pick('河北省', '唐山市'), expect: 'DOGG', label: 'ENFP 河北省→唐山市' },
    { mbti: 'INTJ', d: [2001, 4, 17, 12, 0], loc: pick('海外/其他', '首尔'), expect: 'BOSS', label: 'INTJ 海外→首尔' },
    { mbti: 'ISFP', d: [2002, 9, 10, 6, 10], loc: pick('河北省', '唐山市'), expect: 'CPBR', label: 'ISFP 河北省→唐山市' }
  ];
  for (const t of cases) {
    const chart = L.computeChart({ year: t.d[0], month: t.d[1], day: t.d[2], hour: t.d[3], minute: t.d[4], hasTime: true, lat: t.loc.lat, lng: t.loc.lng, tz: t.loc.tz });
    const res = L.computeResult(t.mbti, chart, true);
    const ok = res.winner.code === t.expect;
    if (!ok) fail++;
    console.log(`回归 ${t.label} → ${res.winner.code}（期望 ${t.expect}）${ok ? 'OK' : '!!MISMATCH'} 置信度=${res.confidence}`);
  }
  // 无出生时间路径①：同一人「填时间 vs 不知道时间」双路径，均出结果且置信度不同
  const locTS = pick('河北省', '唐山市');
  const withTime = L.computeResult('ENFP', L.computeChart({ year: 2002, month: 12, day: 5, hour: 7, minute: 5, hasTime: true, lat: locTS.lat, lng: locTS.lng, tz: locTS.tz }), true);
  const chartNT = L.computeChart({ year: 2002, month: 12, day: 5, hasTime: false, lat: locTS.lat, lng: locTS.lng, tz: locTS.tz });
  const noTimeRes = L.computeResult('ENFP', chartNT, false);
  const dualOk = withTime.confidence !== noTimeRes.confidence && noTimeRes.confidence === '可能有趣'
    && chartNT.moonDropped === true && chartNT.placements.moon === null && chartNT.placements.asc === null;
  if (!dualOk) fail++;
  console.log(`双路径(2002-12-05 月亮换座日): 有时间→${withTime.winner.code}/${withTime.confidence}, 无时间→${noTimeRes.winner.code}/${noTimeRes.confidence} (月亮已弃用, 上升不参与) ${dualOk ? 'OK' : '!!FAIL'}`);
  // 无出生时间路径②：当天月亮不换座 → 月亮保留、上升不参与、置信度仍降档
  const locSeoul = pick('海外/其他', '首尔');
  const chartNT2 = L.computeChart({ year: 2001, month: 4, day: 17, hasTime: false, lat: locSeoul.lat, lng: locSeoul.lng, tz: locSeoul.tz });
  const noTimeRes2 = L.computeResult('INTJ', chartNT2, false);
  const keepOk = chartNT2.moonDropped === false && chartNT2.placements.moon !== null
    && chartNT2.placements.asc === null && noTimeRes2.confidence === '可能有趣';
  if (!keepOk) fail++;
  console.log(`无时间·月亮不换座(2001-04-17): →${noTimeRes2.winner.code}/${noTimeRes2.confidence} (月亮保留=${L.SIGNS[chartNT2.placements.moon]}, 上升不参与) ${keepOk ? 'OK' : '!!FAIL'}`);
  // 人设文案与《恋爱人设图鉴.md》逐字对齐（介绍段第一行=first，其余=detail）
  const atlas = fs.readFileSync(path.join(path.dirname(ROOT), '恋爱人设图鉴.md'), 'utf8');
  const sections = atlas.split(/^### /m).slice(1);
  const atlasIntro = {};
  for (const sec of sections) {
    const code = sec.split(/[ ·\n]/)[0].trim();
    const m = sec.match(/- \*\*介绍\*\*：\n([\s\S]*)$/);
    if (!m) continue;
    const lines = m[1].split('\n').map(s => s.replace(/^\s+/, '')).filter(s => s !== '');
    atlasIntro[code] = { first: lines[0], detail: lines.slice(1).join('\n') };
  }
  let alignFail = 0;
  for (const p of L.PERSONAS) {
    const a = atlasIntro[p.code];
    if (!a) { console.log('!! 图鉴中找不到介绍段:', p.code); alignFail++; continue; }
    if (p.first !== a.first) { console.log(`!! ${p.code} 第一句不一致\n  logic: ${p.first}\n  图鉴 : ${a.first}`); alignFail++; }
    if (p.detail !== a.detail) { console.log(`!! ${p.code} 详细介绍不一致\n  logic: ${p.detail}\n  图鉴 : ${a.detail}`); alignFail++; }
  }
  fail += alignFail;
  if (!alignFail) console.log('文案对齐: 20 人设 first/detail 与图鉴逐字一致 OK');

  // 人设数据完整性
  if (L.PERSONAS.length !== 20) { console.log('!! 人设数 =', L.PERSONAS.length, '应为 20'); fail++; }
  if (Object.keys(L.MBTI_TABLE).length !== 16) { console.log('!! MBTI 数不是 16'); fail++; }
  const noCP = L.PERSONAS.filter(p => !L.CP[p.code]);
  if (noCP.length) { console.log('!! 缺 CP 文案:', noCP.map(p => p.code).join(',')); fail++; }
  for (const [m, b] of Object.entries(L.MBTI_TABLE)) {
    for (const c of [...b.first, ...b.second]) if (!L.PERSONA_MAP[c]) { console.log('!! MBTI 表非法代号', m, c); fail++; }
  }
  console.log('人设数据: 20 人设 / 16 MBTI / CP 全覆盖 OK');
}

// 4. app.js 引用的 DOM id 均存在于 index.html
const html = read('index.html');
const app = read('app.js');
const ids = [...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
const missing = ids.filter(id => !new RegExp(`id="${id}"`).test(html));
if (missing.length) { console.log('!! index.html 缺少元素 id:', missing.join(', ')); fail++; }
else console.log(`DOM 校验: app.js 引用的 ${ids.length} 个 id 全部存在 OK`);

// 5. index.html 脚本顺序
const order = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const wantOrder = ['astronomy.browser.min.js', 'cities.js', 'logic.js', 'app.js'];
if (JSON.stringify(order) !== JSON.stringify(wantOrder)) { console.log('!! 脚本加载顺序异常:', order.join(' → ')); fail++; }
else console.log('脚本加载顺序 OK:', order.join(' → '));

// 6. CP 卡不应再有「ta 的视角」
if (/cpTheirs/.test(html) || /cpTheirs/.test(app)) { console.log('!! 仍残留 ta 视角元素 cpTheirs'); fail++; }
else console.log('CP 单视角 OK（无 cpTheirs 残留）');

// 7. 结果页不应再有隐藏人设（星盘暗面）卡片；数据层 computeResult 的 hidden 字段允许保留
if (/hiddenCard|hName|hLine|星盘暗面/.test(html) || /hiddenCard|hName|hLine|星盘暗面/.test(app)) { console.log('!! 页面仍残留隐藏人设卡片'); fail++; }
else console.log('隐藏人设卡片已移除 OK（页面无 hiddenCard/星盘暗面 残留）');

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项失败 ✗`);
process.exit(fail === 0 ? 0 : 1);
