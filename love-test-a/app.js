/* 表单交互 + 结果渲染 + 数据存储 + 准不准反馈 */
(function () {
'use strict';
var SCHEME = window.SCHEME || 'A';

var P = window.PDATA.personas, CP = window.PDATA.cp, PMAP = {};
P.forEach(function (p) { PMAP[p.code] = p; });
var $ = function (id) { return document.getElementById(id); };

/* ---------- 表单填充 ---------- */
function fill(sel, arr, ph) {
  var s = $(sel); s.innerHTML = '<option value="">' + ph + '</option>';
  arr.forEach(function (v) { var o = document.createElement('option'); o.value = v[0]; o.textContent = v[1]; s.appendChild(o); });
}
var yrs = []; for (var y = 2015; y >= 1960; y--) yrs.push([y, y + ' 年']);
var mos = []; for (var m = 1; m <= 12; m++) mos.push([m, m + ' 月']);
var hrs = []; for (var h = 0; h < 24; h++) hrs.push([h, (h < 10 ? '0' : '') + h + ' 时']);
var mis = []; for (var i = 0; i < 60; i++) mis.push([i, (i < 10 ? '0' : '') + i + ' 分']);
fill('selYear', yrs, '年'); fill('selMonth', mos, '月'); fill('selHour', hrs, '时'); fill('selMinute', mis, '分');
function days() {
  var y = +$('selYear').value, m = +$('selMonth').value, n = 31;
  if (y && m) n = new Date(y, m, 0).getDate();
  var cur = $('selDay').value, a = []; for (var d = 1; d <= n; d++) a.push([d, d + ' 日']);
  fill('selDay', a, '日'); if (cur && cur <= n) $('selDay').value = cur;
}
$('selYear').onchange = days; $('selMonth').onchange = days; days();

var PROV = (window.CityData && window.CityData.PROVINCES) || [];
var getCity = (window.CityData && window.CityData.getCity) || function(pi,ci){var c=PROV[pi].cities[ci];return {name:c[0],lat:c[1],lng:c[2],tz:c[3]||'Asia/Shanghai'};};
function fillProv() {
  var s = $('selProvince'); s.innerHTML = '<option value="">省 / 直辖市</option>';
  PROV.forEach(function (p, i) { var o = document.createElement('option'); o.value = i; o.textContent = p.name; s.appendChild(o); });
}
function fillCity() {
  var pi = $('selProvince').value, s = $('selCity');
  s.innerHTML = '<option value="">市 / 区</option>';
  if (pi === '') return;
  (PROV[pi].cities || []).forEach(function (c, i) { var o = document.createElement('option'); o.value = i; o.textContent = c[0]; s.appendChild(o); });
  if ((PROV[pi].cities || []).length === 1) s.value = 0;
}
fillProv(); $('selProvince').onchange = fillCity;

var MBTIS = ['ENFP','ENFJ','ENTP','ENTJ','ESFP','ESFJ','ESTP','ESTJ','INFP','INFJ','INTP','INTJ','ISFP','ISFJ','ISTP','ISTJ'];
var ms = $('mbti'); ms.innerHTML = '<option value="">请选择</option>';
MBTIS.forEach(function (m) { var o = document.createElement('option'); o.value = m; o.textContent = m; ms.appendChild(o); });

var noTime = false;
$('noTimeBtn').onclick = function () {
  noTime = !noTime; this.classList.toggle('on', noTime);
  this.setAttribute('aria-pressed', noTime);
  $('noTimeHint').classList.toggle('show', noTime);
  $('timeRow').style.opacity = noTime ? .4 : 1;
  $('selHour').disabled = $('selMinute').disabled = noTime;
};
$('advToggle').onclick = function () { $('advBox').classList.toggle('show'); };

/* ---------- 主流程 ---------- */
$('go').onclick = function () {
  var e = $('err'); e.style.display = 'none';
  var y = +$('selYear').value, mo = +$('selMonth').value, d = +$('selDay').value, mbti = $('mbti').value;
  if (!y || !mo || !d) return fail('请选择完整的出生日期');
  if (!mbti) return fail('请选择你的 MBTI');
  var hh = 12, mm = 0;
  if (!noTime) {
    if ($('selHour').value === '' || $('selMinute').value === '') return fail('请选择出生时间，或点「我不知道出生时间」');
    hh = +$('selHour').value; mm = +$('selMinute').value;
  }
  var lat = parseFloat($('lat').value), lng = parseFloat($('lng').value), off = parseFloat($('utcoff').value);
  var tz, cityName = '手动坐标';
  if (!isNaN(lat) && !isNaN(lng)) { tz = isNaN(off) ? 8 * 60 : off * 60; }
  else {
    var pi = $('selProvince').value, ci = $('selCity').value;
    if (pi === '' || ci === '') return fail('请选择出生地点');
    var c = getCity(+pi, +ci);
    lat = c.lat; lng = c.lng; tz = c.tz || 'Asia/Shanghai';
    cityName = PROV[pi].name + ' ' + c.name;
  }
  function fail(msg) { e.textContent = msg; e.style.display = 'block'; }

  var ch = L7.chart({ year: y, month: mo, day: d, hour: hh, minute: mm, lat: lat, lng: lng, tz: tz, hasTime: !noTime });
  var U = L7.profile(ch, mbti);
  var ft = L7.feats(ch);
  var res = L7.judge(U, mbti, ft, SCHEME);
  var conf = L7.confidence(res, ch);
  render(ch, U, res, conf);

  $('result').style.display = 'block';
  window.scrollTo({ top: $('result').offsetTop - 10, behavior: 'smooth' });
};
function pad(n) { return (n < 10 ? '0' : '') + n; }

function setImg(img, em, p) {
  em.textContent = p.emoji; em.style.display = 'none';
  var tried = 0;
  img.onerror = function () {
    tried++;
    if (tried === 1) { img.src = 'img/' + p.code + '.svg'; }
    else { img.style.display = 'none'; em.style.display = 'block'; }
  };
  img.style.display = 'block';
  img.src = 'img/' + p.code + '.png';
}

function render(ch, U, res, conf) {
  var p = PMAP[res.winner.code];
  setImg($('rImg'), $('rEmoji'), p);
  $('rName').textContent = p.name;
  $('rCode').textContent = p.code;
  $('rLine').textContent = p.first;
  $('rIntro').textContent = p.detail;

  var cp = CP[p.code];
  if (cp && cp.partner) {
    var q = PMAP[cp.partner];
    setImg($('cpImg'), $('cpEmoji'), q);
    $('cpName').textContent = q.name;
    $('cpCode').textContent = q.code;
    $('cpMine').textContent = cp.mine;
    $('cpCard').style.display = 'block';
  } else if (cp) {
    $('cpImg').style.display = 'none'; $('cpEmoji').style.display = 'none';
    $('cpName').textContent = '暂无';
    $('cpCode').textContent = '';
    $('cpMine').textContent = cp.mine;
    $('cpCard').style.display = 'block';
  } else { $('cpCard').style.display = 'none'; }

  var warn = [];
  if (!ch.hasTime) warn.push('未填出生时间：上升与宫位未参与计算');
  if (ch.moonUnstable) warn.push('当天月亮跨座，月亮相关维度不可靠');
  warn.push('置信度：' + conf);
  warn.push('12 维：' + L7.DIM.map(function (k) { return k + Math.round(U[k] * 10) / 10; }).join(' '));
  $('dbgWarn').innerHTML = warn.join('<br>');
  $('dbgTable').innerHTML = '<tr><th>人设</th><th>批次</th><th>星盘分</th><th>总分</th></tr>' +
    res.board.slice(0, 10).map(function (r, i) {
      var tag = res.F.indexOf(r.code) >= 0 ? '首选' : (res.S.indexOf(r.code) >= 0 ? '次选' : '批外');
      return '<tr class="' + (i === 0 ? 'win' : '') + '"><td>' + PMAP[r.code].name + '</td><td>' + tag + '</td><td>' + r.chart.toFixed(1) + '</td><td>' + r.total.toFixed(1) + '</td></tr>';
    }).join('');
}

$('again').onclick = function () {
  $('result').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
})();
