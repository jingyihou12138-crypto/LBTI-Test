/* 恋爱人设测试 —— 页面交互（计算逻辑见 logic.js，城市数据见 cities.js） */
(function () {
  'use strict';
  var L = window.PersonaLogic;
  var CD = window.CityData;
  var $ = function (id) { return document.getElementById(id); };

  function fillSelect(sel, items, keepFirst) {
    // items: [{value, text}]
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

  $('noTime').addEventListener('change', function () {
    $('selHour').disabled = this.checked;
    $('selMinute').disabled = this.checked;
    if (this.checked) { $('selHour').value = ''; $('selMinute').value = ''; }
  });

  /* ---- 省市二级联动 ---- */

  var provSel = $('selProvince'), citySel = $('selCity');
  fillSelect(provSel, CD.PROVINCES.map(function (p, i) { return { value: i, text: p.name }; }));

  function refreshCities() {
    var p = CD.PROVINCES[+provSel.value];
    fillSelect(citySel, p.cities.map(function (c, i) { return { value: i, text: c[0] }; }));
    // 直辖市/特别行政区只有一项：直接选中并禁用，视觉上等于一级选中
    citySel.disabled = p.cities.length === 1;
  }
  provSel.addEventListener('change', refreshCities);
  refreshCities();

  /* ---- MBTI ---- */

  var mbtiSel = $('mbti');
  Object.keys(L.MBTI_TABLE).forEach(function (m) {
    var o = document.createElement('option');
    o.value = m; o.textContent = m;
    mbtiSel.appendChild(o);
  });

  $('advToggle').addEventListener('click', function () {
    $('advBox').classList.toggle('show');
  });

  /* ---- 提交 ---- */

  $('go').addEventListener('click', function () {
    var errEl = $('err');
    errEl.style.display = 'none';
    try {
      var yy = +$('selYear').value, mo = +$('selMonth').value, dd = +$('selDay').value;
      if (!yy || !mo || !dd) throw new Error('请选择完整的出生日期');

      var noTime = $('noTime').checked;
      var hv = $('selHour').value, mv = $('selMinute').value;
      var hasTime = !noTime && hv !== '' && mv !== '';
      if (!noTime && (hv === '' || mv === '')) throw new Error('请选择出生时间，或勾选「我不知道出生时间」');

      var lat, lng, tz;
      var mLat = $('lat').value, mLng = $('lng').value;
      if (mLat !== '' && mLng !== '') {
        lat = parseFloat(mLat); lng = parseFloat(mLng);
        var off = $('utcoff').value;
        if (off === '') throw new Error('手动模式请填写 UTC 时区偏移');
        tz = parseFloat(off) * 60; // 固定偏移分钟
        if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 66 || Math.abs(lng) > 180) throw new Error('经纬度不合法（纬度需在 ±66° 内）');
      } else {
        var c = CD.getCity(+provSel.value, +citySel.value);
        lat = c.lat; lng = c.lng; tz = c.tz;
      }

      var input = { year: yy, month: mo, day: dd, hour: hasTime ? +hv : 12, minute: hasTime ? +mv : 0, hasTime: hasTime, lat: lat, lng: lng, tz: tz };
      var chart = L.computeChart(input);
      var res = L.computeResult(mbtiSel.value, chart, hasTime);
      render(res, chart, hasTime);
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

  /* ---- 渲染结果 ---- */

  function render(res, chart, hasTime) {
    var p = L.PERSONA_MAP[res.winner.code];
    $('rEmoji').textContent = p.emoji;
    $('rName').textContent = p.name;
    $('rCode').textContent = p.code;
    $('rType').textContent = p.type;
    $('rConf').textContent = '置信度 · ' + res.confidence;
    $('rLine').textContent = '「' + p.first + '」';
    $('rIntro').textContent = p.detail;

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

    // 调试区
    if (res.profile) {
      $('dbgProfile').textContent = '你的四维画像：F=' + res.profile[0].toFixed(2) +
        '  P=' + res.profile[1].toFixed(2) + '  C=' + res.profile[2].toFixed(2) + '  D=' + res.profile[3].toFixed(2);
    } else {
      $('dbgProfile').textContent = '星盘信息不足，未生成四维画像';
    }
    var tbl = $('dbgTable');
    tbl.innerHTML = '<tr><th>#</th><th>人设</th><th>MBTI分</th><th>贴合分</th><th>总分</th></tr>';
    res.board.forEach(function (r, i) {
      var tr = document.createElement('tr');
      if (r.code === res.winner.code) tr.className = 'win';
      var pi = L.PERSONA_MAP[r.code];
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + pi.name + ' ' + r.code + '</td><td>' +
        r.mbtiScore + '</td><td>' + r.fit.toFixed(2) + '</td><td>' + r.total.toFixed(2) + '</td>';
      tbl.appendChild(tr);
    });

    $('form').style.display = 'none';
    $('result').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
