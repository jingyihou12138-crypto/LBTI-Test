/*
 * 恋爱人设测试 v1/v3 对比版 —— 页面交互
 * v1 打分见 logic.js（与线上生产文件逐字一致），v3 打分见 logic-v3.js，城市数据见 cities.js。
 * 每次提交同时算出 v1 与 v3 两版结果并缓存，切换版本时只重渲染、不重算，所以切换是即时的。
 */
(function () {
  'use strict';
  var L = window.PersonaLogic;      // v1（同时提供天文排盘、人设文案、CP）
  var V3 = window.PersonaLogicV3;   // v3 打分
  var CD = window.CityData;
  var $ = function (id) { return document.getElementById(id); };

  var activeVer = 'v3';   // 默认 v3
  var last = null;        // { chart, hasTime, mbti, r1, r3, meta }

  function fillSelect(sel, items, keepFirst) {
    var first = keepFirst ? sel.options[0] : null;
    sel.innerHTML = '';
    if (first) sel.appendChild(first);
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it.value; o.textContent = it.text;
      sel.appendChild(o);
    });
  }

  /* ---- 出生日期 / 时间下拉 ---- */

  var yearItems = [];
  for (var y = 2020; y >= 1940; y--) yearItems.push({ value: y, text: y + ' 年' });
  fillSelect($('selYear'), yearItems, true);

  var monthItems = [];
  for (var m = 1; m <= 12; m++) monthItems.push({ value: m, text: m + ' 月' });
  fillSelect($('selMonth'), monthItems, true);

  function daysInMonth(y, m) {
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  }
  function refreshDays() {
    var sel = $('selDay');
    var prev = sel.value;
    var n = daysInMonth(+$('selYear').value, +$('selMonth').value);
    var items = [];
    for (var d = 1; d <= n; d++) items.push({ value: d, text: d + ' 日' });
    fillSelect(sel, items, true);
    if (prev && +prev <= n) sel.value = prev;
  }
  refreshDays();
  $('selYear').addEventListener('change', refreshDays);
  $('selMonth').addEventListener('change', refreshDays);

  var hourItems = [];
  for (var h = 0; h < 24; h++) hourItems.push({ value: h, text: (h < 10 ? '0' + h : h) + ' 时' });
  fillSelect($('selHour'), hourItems, true);
  var minItems = [];
  for (var mi = 0; mi < 60; mi++) minItems.push({ value: mi, text: (mi < 10 ? '0' + mi : mi) + ' 分' });
  fillSelect($('selMinute'), minItems, true);

  function noTimeOn() { return $('noTimeBtn').classList.contains('on'); }
  function setNoTime(on) {
    var btn = $('noTimeBtn');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('timeRow').style.display = on ? 'none' : '';
    $('noTimeHint').classList.toggle('show', on);
    if (on) { $('selHour').value = ''; $('selMinute').value = ''; }
  }
  $('noTimeBtn').addEventListener('click', function () { setNoTime(!noTimeOn()); });

  /* ---- 省市二级联动 ---- */

  var provSel = $('selProvince'), citySel = $('selCity');
  fillSelect(provSel, CD.PROVINCES.map(function (p, i) { return { value: i, text: p.name }; }));

  function refreshCities() {
    var p = CD.PROVINCES[+provSel.value];
    fillSelect(citySel, p.cities.map(function (c, i) { return { value: i, text: c[0] }; }));
    citySel.disabled = p.cities.length === 1;
  }
  provSel.addEventListener('change', refreshCities);
  refreshCities();

  /* ---- MBTI ---- */

  var mbtiSel = $('mbti');
  Object.keys(L.MBTI_TABLE).forEach(function (mm) {
    var o = document.createElement('option');
    o.value = mm; o.textContent = mm;
    mbtiSel.appendChild(o);
  });

  $('advToggle').addEventListener('click', function () { $('advBox').classList.toggle('show'); });

  /* ---- 版本切换 ---- */

  $('verSeg').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-v]');
    if (!btn) return;
    var v = btn.getAttribute('data-v');
    if (v === activeVer) return;
    activeVer = v;
    Array.prototype.forEach.call(this.querySelectorAll('button[data-v]'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-v') === v);
    });
    if (last) render();   // 同一份输入立即重算/重渲染
  });

  /* ---- 提交 ---- */

  function readForm() {
    var yy = +$('selYear').value, mo = +$('selMonth').value, dd = +$('selDay').value;
    if (!yy || !mo || !dd) throw new Error('请选择完整的出生日期');

    var noTime = noTimeOn();
    var hv = $('selHour').value, mv = $('selMinute').value;
    var hasTime = !noTime && hv !== '' && mv !== '';
    if (!noTime && (hv === '' || mv === '')) throw new Error('请选择出生时间，或点击「我不知道出生时间」');

    var lat, lng, tz, placeName;
    var mLat = $('lat').value, mLng = $('lng').value;
    if (mLat !== '' && mLng !== '') {
      lat = parseFloat(mLat); lng = parseFloat(mLng);
      var off = $('utcoff').value;
      if (off === '') throw new Error('手动模式请填写 UTC 时区偏移');
      tz = parseFloat(off) * 60;
      if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 66 || Math.abs(lng) > 180) throw new Error('经纬度不合法（纬度需在 ±66° 内）');
      placeName = '手动坐标 ' + lat + ', ' + lng;
    } else {
      var c = CD.getCity(+provSel.value, +citySel.value);
      lat = c.lat; lng = c.lng; tz = c.tz; placeName = c.name;
    }

    return {
      input: { year: yy, month: mo, day: dd, hour: hasTime ? +hv : 12, minute: hasTime ? +mv : 0, hasTime: hasTime, lat: lat, lng: lng, tz: tz },
      hasTime: hasTime, mbti: mbtiSel.value, placeName: placeName
    };
  }

  $('go').addEventListener('click', function () {
    var errEl = $('err');
    errEl.style.display = 'none';
    try {
      var f = readForm();
      var chart = L.computeChart(f.input);
      last = {
        chart: chart, hasTime: f.hasTime, mbti: f.mbti, placeName: f.placeName,
        r1: L.computeResult(f.mbti, chart, f.hasTime),
        r3: V3.computeResult(f.mbti, chart, f.hasTime)
      };
      render();
      $('form').style.display = 'none';
      $('result').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      errEl.textContent = e.message || '计算出错，请检查输入';
      errEl.style.display = 'block';
    }
  });

  $('again').addEventListener('click', function () {
    $('result').style.display = 'none';
    $('form').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---- 渲染 ---- */

  var TIER_CN = { first: '首选当选', second: '次选上位', outside: '批外翻盘' };
  var TIER_ABBR = { first: '首', second: '次', outside: '外' };
  var TIER_CLS = { first: 'f', second: 's', outside: 'o' };

  function v1TierOf(mbti, code) {
    var b = L.MBTI_TABLE[mbti];
    if (!b) return 'outside';
    if (b.first.indexOf(code) >= 0) return 'first';
    if (b.second.indexOf(code) >= 0) return 'second';
    return 'outside';
  }

  function render() {
    var res = activeVer === 'v3' ? last.r3 : last.r1;
    var p = L.PERSONA_MAP[res.winner.code];
    var chart = last.chart, hasTime = last.hasTime;

    renderDiff();
    renderUpset();

    $('rEmoji').textContent = p.emoji;
    $('rName').textContent = p.name;
    $('rCode').textContent = p.code;
    $('rType').textContent = p.type;
    $('rLine').textContent = '「' + p.first + '」';
    $('rIntro').textContent = p.detail;

    // 徽章：版本 + 置信度 + 判定路径
    var badges = $('rBadges');
    badges.innerHTML = '';
    function addBadge(cls, text) {
      var el = document.createElement('span');
      el.className = 'badge ' + cls;
      el.textContent = text;
      badges.appendChild(el);
    }
    addBadge('ver' + (activeVer === 'v1' ? ' is1' : ''), activeVer === 'v1' ? '规则 v1 定稿' : '规则 v3 候选');
    addBadge('', '置信度 · ' + res.confidence);
    var tier = activeVer === 'v3' ? res.winner.tier : v1TierOf(last.mbti, res.winner.code);
    var pathCls = tier === 'outside' ? 'path pUpset' : tier === 'second' ? 'path pSecond' : 'path';
    addBadge(pathCls, (tier === 'outside' ? '⚡ ' : '') + TIER_CN[tier]);

    // 星盘落座 chips
    var chips = $('rChips');
    chips.innerHTML = '';
    var labels = { sun: '☀️ 太阳', moon: '🌙 月亮', venus: '♀ 金星', mars: '♂ 火星', asc: '⬆️ 上升' };
    ['sun', 'moon', 'venus', 'mars', 'asc'].forEach(function (k) {
      var si = chart.placements[k];
      var el = document.createElement('span');
      el.className = 'chip';
      el.textContent = labels[k] + ' ' + (si === null || si === undefined ? (k === 'asc' ? '需出生时间' : '未知') : L.SIGNS[si] + '座');
      chips.appendChild(el);
    });
    if (!hasTime) {
      var note = document.createElement('span');
      note.className = 'chip';
      note.textContent = chart.moonDropped ? '⚠️ 当天月亮换座，已弃用月亮' : 'ℹ️ 未填出生时间，按正午估算';
      chips.appendChild(note);
    }

    // CP（只展示自己视角）
    var cp = L.CP[p.code];
    if (cp && cp.partner) {
      var pp = L.PERSONA_MAP[cp.partner];
      $('cpName').innerHTML = p.emoji + ' ' + p.name + ' × ' + pp.name + ' ' + pp.emoji +
        '<small>' + p.code + ' × ' + pp.code + '</small>';
      $('cpMine').textContent = cp.mine;
    } else {
      $('cpName').innerHTML = '🧘 单身贵族，自己 solo<small>SOLO 光荣单身</small>';
      $('cpMine').textContent = cp.mine;
    }

    renderDebug();
  }

  function renderDiff() {
    var box = $('diffBox');
    var c1 = last.r1.winner.code, c3 = last.r3.winner.code;
    var n1 = L.PERSONA_MAP[c1], n3 = L.PERSONA_MAP[c3];
    if (c1 === c3) {
      box.innerHTML = '<div class="diff same">' +
        '<div class="h">✓ 两版规则结果一致</div>' +
        '<div>v1 与 v3 都判定为 <b>' + n1.emoji + ' ' + n1.name + '（' + c1 + '）</b>，切换版本不会变。</div>' +
        (last.r1.confidence !== last.r3.confidence
          ? '<div class="sub">只有置信度不同：v1「' + last.r1.confidence + '」→ v3「' + last.r3.confidence +
            '」。v3 把强共鸣门槛从贴合分 3.8 抬到 4.2，所以同一个结果可能降一档，这是阈值校准，不是判定变了。</div>'
          : '') +
        '</div>';
    } else {
      box.innerHTML = '<div class="diff chg">' +
        '<div class="h">⚠️ 两版规则结果不同</div>' +
        '<div class="arrow">' +
          '<span class="vtag t1">v1</span> ' + n1.emoji + ' ' + n1.name + ' ' +
          '<span style="opacity:.6">→</span> ' +
          '<span class="vtag t3">v3</span> ' + n3.emoji + ' ' + n3.name +
        '</div>' +
        '<div class="sub">当前显示的是 <b>' + (activeVer === 'v1' ? 'v1' : 'v3') + '</b> 的结果。' +
        '点顶部开关可以来回对比两版的完整文案与得分榜。</div>' +
        '</div>';
    }
  }

  function renderUpset() {
    var box = $('upsetBox');
    box.innerHTML = '';
    // 只在展示 v3 且确实翻盘时显示（翻盘是 v3 独有机制，v1 下这条规则永不可能触发）
    if (activeVer !== 'v3' || !last.r3.upset) return;
    var w = L.PERSONA_MAP[last.r3.winner.code];
    var over = last.r3.upsetOver ? L.PERSONA_MAP[last.r3.upsetOver.code] : null;
    var gap = last.r3.upsetOver ? (last.r3.winner.fit - last.r3.upsetOver.fit) : 0;
    box.innerHTML = '<div class="upset">' +
      '<div class="h">⚡ 星盘翻盘了！</div>' +
      '<div class="b">你的 MBTI（' + last.mbti + '）候选批里没有足够贴合的人设，' +
      '<b>' + w.emoji + ' ' + w.name + '</b> 从批外把 ' +
      (over ? '<b>' + over.emoji + ' ' + over.name + '</b>' : '批内第一') + ' 顶了下去' +
      (over ? '（贴合分领先 ' + gap.toFixed(2) + ' 分，超过 1.5 的翻盘门槛）' : '') + '。<br>' +
      '换句话说：你测出来是 ' + last.mbti + '，但你的月亮金星说你其实是 ' + w.name + '。</div>' +
      '<span class="rate">这个机制全人群触发率只有 2.66%，你抽到了</span>' +
      '</div>';
  }

  function renderDebug() {
    var prof = last.r3.profile || last.r1.profile;
    $('dbgProfile').innerHTML = prof
      ? '你的四维画像（两版共用）：F=' + prof[0].toFixed(2) + '　P=' + prof[1].toFixed(2) +
        '　C=' + prof[2].toFixed(2) + '　D=' + prof[3].toFixed(2) +
        '<br>F 情绪 · P 推进 · C 亲密 · D 应对'
      : '星盘信息不足，未生成四维画像';

    buildTable($('dbgT1'), last.r1, 'v1');
    buildTable($('dbgT3'), last.r3, 'v3');

    // 差异说明
    var c1 = last.r1.winner.code, c3 = last.r3.winner.code;
    var notes = [];
    if (c1 !== c3) {
      notes.push('<b>为什么两版结果不同：</b>' + why(c1, c3));
    }
    var changed = Object.keys(V3.FPCD_OVERRIDES).filter(function (code) {
      return code === c1 || code === c3;
    });
    if (changed.length) {
      notes.push(changed.map(function (code) {
        var o = V3.FPCD_OVERRIDES[code];
        return L.PERSONA_MAP[code].name + ' 的四维值 v3 有改动：[' + o.from.join(', ') + '] → [' + o.to.join(', ') + ']';
      }).join('；'));
    }
    var b1 = L.MBTI_TABLE[last.mbti], b3 = V3.MBTI_TABLE[last.mbti];
    if (b1 && b3 && b1.first.join(',') !== b3.first.join(',')) {
      notes.push(last.mbti + ' 的首选批 v3 有改动：[' + b1.first.join('、') + '] → [' + b3.first.join('、') + ']');
    }
    $('dbgNote').innerHTML = notes.length ? notes.join('<br>') : '这个输入下两版的候选批与相关四维值都没有差别，所以结果相同。';
  }

  function why(c1, c3) {
    var t3 = last.r3.winner.tier;
    if (t3 === 'outside') return 'v3 触发了批外翻盘 —— ' + L.PERSONA_MAP[c3].name + ' 不在 ' + last.mbti + ' 的候选批里，靠贴合分优势超过 1.5 分的门槛翻上来。v1 的翻盘门槛是 4 分，而同盘贴合分极差最多只有 2.758，所以 v1 永远不可能翻盘。';
    if (t3 === 'second') return 'v3 下 ' + L.PERSONA_MAP[c3].name + ' 作为次选反超了首选。';
    var b1 = L.MBTI_TABLE[last.mbti], b3 = V3.MBTI_TABLE[last.mbti];
    if (b3.first.indexOf(c3) >= 0 && b1.first.indexOf(c3) < 0) {
      return L.PERSONA_MAP[c3].name + ' 在 v3 里被提升为 ' + last.mbti + ' 的首选（v1 只是次选，拿 +2 分永远追不上首选的 +4），拿到 +4 后贴合分优势就生效了。';
    }
    if (Object.keys(V3.FPCD_OVERRIDES).indexOf(c3) >= 0 || Object.keys(V3.FPCD_OVERRIDES).indexOf(c1) >= 0) {
      return 'v3 改了相关人设的四维值，贴合分排序因此变化（详见下方改动说明）。';
    }
    return 'v3 修正了并列裁决规则：v1 在总分完全并列时取数组书写顺序的第一个，v3 改成确定性规则（字母组 → 批内层级 → 贴合分 → 代号字典序）。';
  }

  function buildTable(tbl, res, ver) {
    tbl.innerHTML = '<tr><th>#</th><th>人设</th><th>总分</th></tr>';
    res.board.forEach(function (r, i) {
      var tr = document.createElement('tr');
      var isWin = r.code === res.winner.code;
      if (isWin) tr.className = 'win' + (ver === 'v3' && res.upset ? ' upsetRow' : '');
      var tier = ver === 'v3' ? r.tier : v1TierOf(last.mbti, r.code);
      var pi = L.PERSONA_MAP[r.code];
      tr.innerHTML = '<td>' + (i + 1) + '</td>' +
        '<td class="nm">' + pi.name + '<span class="tg ' + TIER_CLS[tier] + '">' + TIER_ABBR[tier] + '</span></td>' +
        '<td>' + r.total.toFixed(2) + '</td>';
      tbl.appendChild(tr);
    });
  }

  /* ---- 快捷试玩案例（数据源：demo-cases.js，与验证脚本共用） ---- */

  var DEMO_CASES = window.DemoCases || [];

  function provIndex(name) {
    for (var i = 0; i < CD.PROVINCES.length; i++) if (CD.PROVINCES[i].name === name) return i;
    return -1;
  }
  function cityIndex(pi, name) {
    var cs = CD.PROVINCES[pi].cities;
    for (var i = 0; i < cs.length; i++) if (cs[i][0] === name) return i;
    return -1;
  }

  var caseList = $('caseList');
  var lastGroup = null;
  DEMO_CASES.forEach(function (c) {
    var pi = provIndex(c.prov);
    if (pi < 0) return;
    var ci = cityIndex(pi, c.city);
    if (ci < 0) return;
    if (c.group !== lastGroup) {
      var g = document.createElement('div');
      g.className = 'case-group';
      g.textContent = c.group;
      caseList.appendChild(g);
      lastGroup = c.group;
    }
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'case-btn';
    b.innerHTML = '<b>' + c.label + '</b><br>' +
      (c.expect && c.expect.upset ? '<i>⚡ ' + c.note + '</i>' : c.note);
    b.addEventListener('click', function () {
      $('selYear').value = c.y;
      $('selMonth').value = c.mo;
      refreshDays();
      $('selDay').value = c.d;
      setNoTime(false);
      $('selHour').value = c.h;
      $('selMinute').value = c.mi;
      $('lat').value = ''; $('lng').value = ''; $('utcoff').value = '';
      provSel.value = pi;
      refreshCities();
      citySel.value = ci;
      mbtiSel.value = c.mbti;
      $('go').click();
    });
    caseList.appendChild(b);
  });
})();
