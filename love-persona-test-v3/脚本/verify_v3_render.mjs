// v1/v3 对比页「渲染文案」验证
// 运行：node 人设测试网页v3/脚本/verify_v3_render.mjs
//
// verify_v3_page.mjs 验的是打分正确性；这支验的是**页面真的把话说对了**：
// 版本切换后是否即时重渲染、差异横幅/翻盘横幅的文案与出现条件、徽章上的判定路径、双列得分榜。
//
// 不依赖任何第三方库（项目全程零依赖）：用一个刚好够跑 app.js 的极简 DOM shim，
// 在 node 里真实执行 index.html 引的那几个脚本，然后把渲染出来的文字抓出来断言。

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

let fail = 0;
const ok = (cond, msg, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${msg}${extra ? '  ' + extra : ''}`);
  if (!cond) fail++;
};

/* ============ 极简 DOM shim ============ */

const stripTags = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = {};
    this._text = '';
    this._html = '';
    this._cls = new Set();
    this._on = {};
    this.value = '';
    this.disabled = false;
    this.classList = {
      add: (c) => this._cls.add(c),
      remove: (c) => this._cls.delete(c),
      contains: (c) => this._cls.has(c),
      toggle: (c, force) => {
        const on = force === undefined ? !this._cls.has(c) : !!force;
        if (on) this._cls.add(c); else this._cls.delete(c);
        return on;
      }
    };
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text || stripTags(this._html) + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._text = String(v); this._html = ''; this.children = []; }
  get innerHTML() { return this._html + this.children.map((c) => c.innerHTML || c.textContent).join(''); }
  set innerHTML(v) { this._html = String(v); this._text = ''; this.children = []; }
  get options() { return this.children.filter((c) => c.tagName === 'OPTION'); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  addEventListener(ev, fn) { (this._on[ev] = this._on[ev] || []).push(fn); }
  fire(ev, e) { (this._on[ev] || []).forEach((fn) => fn.call(this, e || { target: this })); }
  click() { this.fire('click', { target: this }); }
  querySelectorAll(sel) {
    const m = /^button\[data-v\]$/.test(sel);
    return this.children.filter((c) => (m ? c.attrs['data-v'] !== undefined : false));
  }
  // 整棵子树的可见文字
  allText() {
    return (this._text || '') + '\n' + stripTags(this._html) + '\n' +
      this.children.map((c) => c.allText()).join('\n');
  }
}

function buildDom(html) {
  const byId = {};
  // 用 index.html 里真实出现的 id 建节点（顺序无关，app.js 只按 id 取）
  for (const m of html.matchAll(/id="([^"]+)"/g)) byId[m[1]] = new El('div');
  // 需要 data-v 的两个版本按钮，挂到 verSeg 下
  const seg = byId['verSeg'];
  ['v1', 'v3'].forEach((v) => {
    const b = new El('button');
    b.setAttribute('data-v', v);
    if (v === 'v3') b.classList.add('on');
    b.closest = () => b;
    seg.appendChild(b);
  });
  const document = {
    getElementById: (id) => byId[id] || null,
    createElement: (t) => new El(t)
  };
  return { byId, document, seg };
}

/* ============ 加载页面脚本 ============ */

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const { byId, document, seg } = buildDom(html);

const sandbox = { console, document };
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.scrollTo = () => {};
sandbox.Date = Date;
sandbox.Intl = Intl;
sandbox.Math = Math;
vm.createContext(sandbox);
for (const f of ['astronomy.browser.min.js', 'cities.js', 'logic.js', 'logic-v3.js', 'demo-cases.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
ok(true, 'app.js 在 DOM shim 下无异常执行完毕');

const DEMO = sandbox.DemoCases;
const L = sandbox.PersonaLogic;
const activeVerBtn = () => (seg.children.find((b) => b._cls.has('on')) || {}).attrs?.['data-v'];

ok(activeVerBtn() === 'v3', '默认版本 = v3');
ok(byId['caseList'].children.filter((c) => c.tagName === 'BUTTON').length === DEMO.length,
  `试玩入口渲染出 ${DEMO.length} 个案例按钮`,
  `实得 ${byId['caseList'].children.filter((c) => c.tagName === 'BUTTON').length} 个`);

/* ============ 工具：跑一个 demo 案例 / 切版本 ============ */

const runDemo = (label) => {
  const idx = DEMO.findIndex((c) => c.label === label);
  if (idx < 0) throw new Error('找不到案例 ' + label);
  // caseList 里按钮顺序与 DEMO 一致（分组标题是 div，不是 button）
  const btns = byId['caseList'].children.filter((c) => c.tagName === 'BUTTON');
  btns[idx].click();
};
const switchTo = (v) => {
  const b = seg.children.find((x) => x.attrs['data-v'] === v);
  seg.fire('click', { target: b });
};
const T = (id) => byId[id].allText().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

/* ============ 案例 A：ISTJ 广州 —— 两版不同 + v3 翻盘 ============ */

console.log('\n---- 案例 A：ISTJ · 1990-11-25 21:30 广州（v3 应翻盘）----');
runDemo('ISTJ · 1990-11-25 21:30 广州');

ok(byId['result'].style.display === 'block' && byId['form'].style.display === 'none', '提交后切到结果视图');
ok(byId['rName'].textContent === '林黛玉', 'v3 结果人设 = 林黛玉', `实得 ${byId['rName'].textContent}`);

const diffA = T('diffBox');
console.log('  差异横幅：' + diffA);
ok(/两版规则结果不同/.test(diffA), '差异横幅提示「两版规则结果不同」');
ok(/v1/.test(diffA) && /保温杯/.test(diffA) && /v3/.test(diffA) && /林黛玉/.test(diffA),
  '差异横幅同时写出 v1 保温杯 → v3 林黛玉');

const upsetA = T('upsetBox');
console.log('  翻盘横幅：' + upsetA);
ok(/星盘翻盘/.test(upsetA), 'v3 下显示翻盘横幅');
ok(/ISTJ/.test(upsetA), '翻盘横幅点出用户的 MBTI');
ok(/2\.66%/.test(upsetA), '翻盘横幅写出 2.66% 触发率');
ok(/1\.5/.test(upsetA) && /领先/.test(upsetA), '翻盘横幅说明领先幅度与 1.5 门槛');
ok(/你测出来是 ISTJ.*但你的月亮金星说你其实是 林黛玉/.test(upsetA), '翻盘横幅给出反差叙事文案');

const badgeA = T('rBadges');
console.log('  徽章：' + badgeA);
ok(/规则 v3 候选/.test(badgeA), '徽章标出当前是 v3');
ok(/批外翻盘/.test(badgeA), '徽章标出判定路径 = 批外翻盘');

/* ============ 切到 v1：应即时重渲染，翻盘横幅消失 ============ */

console.log('\n---- 切到 v1（同一份输入立即重算）----');
switchTo('v1');
ok(activeVerBtn() === 'v1', '开关状态切到 v1');
ok(byId['rName'].textContent === '保温杯', 'v1 结果人设 = 保温杯', `实得 ${byId['rName'].textContent}`);
ok(T('upsetBox') === '', 'v1 下翻盘横幅消失（翻盘是 v3 独有机制）');
const badgeA1 = T('rBadges');
console.log('  徽章：' + badgeA1);
ok(/规则 v1 定稿/.test(badgeA1), '徽章切成 v1 定稿');
ok(/首选当选/.test(badgeA1), 'v1 下判定路径 = 首选当选');
ok(/两版规则结果不同/.test(T('diffBox')), '切版本后差异横幅仍在');

console.log('\n---- 切回 v3 ----');
switchTo('v3');
ok(byId['rName'].textContent === '林黛玉' && /星盘翻盘/.test(T('upsetBox')), '切回 v3 恢复林黛玉且翻盘横幅重现');

/* ============ 双列得分榜 ============ */

console.log('\n---- 双列得分榜 ----');
const t1 = byId['dbgT1'], t3 = byId['dbgT3'];
const rows = (t) => t.children.filter((r) => r.tagName === 'TR');
ok(rows(t1).length === 20 && rows(t3).length === 20, '两列各 20 行人设', `v1 ${rows(t1).length} 行 / v3 ${rows(t3).length} 行`);
ok(/首|次|外/.test(T('dbgT3')), 'v3 列带层级标记（首/次/外）');
const winRow1 = rows(t1).find((r) => r._cls.has('win'));
const winRow3 = rows(t3).find((r) => r._cls.has('win'));
ok(/保温杯/.test(winRow1.textContent), 'v1 列高亮的是保温杯');
ok(/林黛玉/.test(winRow3.textContent) && winRow3._cls.has('upsetRow'), 'v3 列高亮的是林黛玉且带翻盘样式');
console.log('  四维画像行：' + T('dbgProfile'));
ok(/F=/.test(T('dbgProfile')) && /两版共用/.test(T('dbgProfile')), '四维画像行说明两版共用');
console.log('  差异说明：' + T('dbgNote'));
ok(/为什么两版结果不同/.test(T('dbgNote')) && /翻盘/.test(T('dbgNote')), '调试区解释了两版差异原因');

/* ============ 案例 B：本人 ENFP —— 两版一致 ============ */

console.log('\n---- 案例 B：本人 ENFP · 2002-12-05 07:05 唐山（两版应一致）----');
byId['again'].click();
ok(byId['form'].style.display === 'block', '「再测一次」回到表单');
runDemo('本人 ENFP · 2002-12-05 07:05 唐山');
ok(byId['rName'].textContent === '狗勾', '结果人设 = 狗勾', `实得 ${byId['rName'].textContent}`);
const diffB = T('diffBox');
console.log('  差异横幅：' + diffB);
ok(/两版规则结果一致/.test(diffB), '一致时显示「两版规则结果一致」');
ok(/狗勾/.test(diffB), '一致横幅写出人设名');
ok(T('upsetBox') === '', '未翻盘时不显示翻盘横幅');
// 本人案例 v1 是「强共鸣」、v3 是「值得探索」，横幅应主动解释这个降档
ok(/置信度不同/.test(diffB) && /强共鸣/.test(diffB) && /值得探索/.test(diffB),
  '一致但置信度不同时，横幅解释了降档原因');

/* ============ 案例 C：结构修复类（ESFJ 妈妈 → 狗勾） ============ */

console.log('\n---- 案例 C：ESFJ · 1992-01-08 02:20 广州（结构修复）----');
byId['again'].click();
runDemo('ESFJ · 1992-01-08 02:20 广州');
ok(byId['rName'].textContent === '狗勾', 'v3 结果 = 狗勾', `实得 ${byId['rName'].textContent}`);
const noteC = T('dbgNote');
console.log('  差异说明：' + noteC);
ok(/首选/.test(noteC) && /ESFJ/.test(noteC), '调试区说明 ESFJ 候选批的首选改动');
switchTo('v1');
ok(byId['rName'].textContent === '妈妈', '切到 v1 变回妈妈', `实得 ${byId['rName'].textContent}`);
switchTo('v3');

/* ============ CP / 文案没退化 ============ */

console.log('\n---- 沿用现有实现的部分 ----');
ok(T('cpName').length > 0 && T('cpMine').length > 20, 'CP 卡（单视角）有内容', T('cpName'));
ok(byId['rIntro'].textContent.length > 40, '人设详细介绍（两段式第二段）有内容');
ok(byId['rLine'].textContent.startsWith('「'), '人设第一句用引号包裹');
ok(T('rChips').includes('太阳') && T('rChips').includes('上升'), '星盘落座 chips 完整');
ok(byId['selProvince'].children.length > 30 && byId['selCity'].children.length > 0, '省市二级联动已填充');
ok(byId['selYear'].children.length > 70 && byId['selDay'].children.length > 0, '年/月/日下拉已填充');
ok(byId['mbti'].children.length === 16, 'MBTI 下拉 16 项');

// 「我不知道出生时间」开关
byId['again'].click();
byId['noTimeBtn'].click();
ok(byId['noTimeBtn']._cls.has('on') && byId['timeRow'].style.display === 'none' && byId['noTimeHint']._cls.has('show'),
  '「我不知道出生时间」开关：选中态 + 隐藏时间行 + 显示提示');
byId['noTimeBtn'].click();
ok(!byId['noTimeBtn']._cls.has('on') && byId['timeRow'].style.display === '', '再点一次可取消');

console.log(fail === 0 ? '\n全部通过 ✓' : `\n${fail} 项未通过 ✗`);
process.exit(fail === 0 ? 0 : 1);
