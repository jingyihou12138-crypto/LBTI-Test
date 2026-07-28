// 对拍脚本：JS 天文计算 & 映射结果 vs Python 权威盘（chart_astrology.py）
// 运行：node 人设测试网页/脚本/verify_astro.mjs
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // 人设测试网页/
const L = require(path.join(ROOT, 'logic.js'));

// 权威结果：由 .venv-divination + chart_astrology.py 生成（/tmp/chart{1,2,3}.json）
const CASES = [
  {
    name: '案例1 ENFP 2002-12-05 07:05 唐山', mbti: 'ENFP',
    input: { year: 2002, month: 12, day: 5, hour: 7, minute: 5, hasTime: true, lat: 39.6305, lng: 118.1804, tz: 'Asia/Shanghai' },
    authority: { sun: 'Sag', moon: 'Sag', venus: 'Sco', mars: 'Sco', asc: 'Sag', ascLon: 250.1273 },
    expectPersona: 'DOGG'
  },
  {
    name: '案例2 INTJ 2001-04-17 12:00 首尔', mbti: 'INTJ',
    input: { year: 2001, month: 4, day: 17, hour: 12, minute: 0, hasTime: true, lat: 37.5665, lng: 126.9780, tz: 'Asia/Seoul' },
    authority: { sun: 'Ari', moon: 'Aqu', venus: 'Ari', mars: 'Sag', asc: 'Leo', ascLon: 121.2168 },
    expectPersona: 'BOSS'
  },
  {
    name: '案例3 ISFP 2002-09-10 06:10 唐山', mbti: 'ISFP',
    input: { year: 2002, month: 9, day: 10, hour: 6, minute: 10, hasTime: true, lat: 39.6305, lng: 118.1804, tz: 'Asia/Shanghai' },
    authority: { sun: 'Vir', moon: 'Lib', venus: 'Sco', mars: 'Vir', asc: 'Vir', ascLon: 171.551 },
    expectPersona: 'CPBR'
  }
];

let fail = 0;
for (const c of CASES) {
  console.log('\n=== ' + c.name + ' ===');
  const chart = L.computeChart(c.input);
  const p = chart.placements;
  for (const key of ['sun', 'moon', 'venus', 'mars', 'asc']) {
    const got = L.SIGN_EN[p[key]];
    const ok = got === c.authority[key];
    if (!ok) fail++;
    console.log(`  ${key.padEnd(5)} JS=${got}(${L.SIGNS[p[key]]}) 权威=${c.authority[key]} ${ok ? 'OK' : '!!MISMATCH'}`);
  }
  const dAsc = Math.abs(chart.longitudes.asc - c.authority.ascLon);
  console.log(`  上升黄经 JS=${chart.longitudes.asc.toFixed(4)}° 权威=${c.authority.ascLon}° 差=${dAsc.toFixed(4)}°${dAsc < 0.5 ? '' : ' !!LARGE'}`);
  if (dAsc >= 0.5) fail++;

  const res = L.computeResult(c.mbti, chart, true);
  const ok = res.winner.code === c.expectPersona;
  if (!ok) fail++;
  console.log(`  本命人设 = ${res.winner.code}（期望 ${c.expectPersona}）${ok ? 'OK' : '!!MISMATCH'}  置信度=${res.confidence}  隐藏=${res.hidden ? res.hidden.code : '无'}`);
  console.log('  得分榜前5: ' + res.board.slice(0, 5).map(r => `${r.code}=${r.total.toFixed(2)}(mbti${r.mbtiScore}+贴合${r.fit.toFixed(2)})`).join('  '));
}

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项不一致 ✗`);
process.exit(fail === 0 ? 0 : 1);
