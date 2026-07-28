/*
 * 恋爱人设映射规则 v3 —— 浏览器版打分逻辑
 * 规则来源：../恋爱人设映射规则（v3）.md
 * node 端等价实现：../人设测试网页/脚本/logic_v3.mjs（两者由 脚本/verify_v3_page.mjs 逐案例对拍）
 *
 * 依赖：logic.js（v1）。天文排盘（computeChart）、人设文案、CP 数据全部复用 v1，
 * 本文件只重写「打分 / 映射」这一层。v1 的 logic.js 一行未改。
 *
 * 设计立场：MBTI 主锚，星盘批内区分。
 *   首选 +4 / 次选 +2 与 v1 完全一致；翻盘门槛拆成独立参数 UPSET_MARGIN=1.5。
 *
 * UMD：浏览器挂 window.PersonaLogicV3；node 可 require 用于对拍。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./logic.js'));
  } else {
    root.PersonaLogicV3 = factory(root.PersonaLogic);
  }
})(typeof self !== 'undefined' ? self : this, function (V1) {
  'use strict';

  /* ============ 配置（= 规则文档 v3 定稿取值） ============ */

  var FIRST = 4;          // 首选基础分，与 v1 同
  var SECOND = 2;         // 次选基础分，与 v1 同
  var UPSET_MARGIN = 1.5; // 批外翻盘门槛（v3 新增的独立参数，与基础分解耦）
  var CONF_STRONG = 4.2;
  var CONF_WORTH = 3.6;

  /* ============ v3 四维值改动（5 处，其余从 v1 继承） ============ */

  var FPCD_OVERRIDES = {
    ROBOT: { from: [0.3, 0.7, 0.3, 0.3], to: [0.3, 0.3, 0.7, 0.3] },
    SOLO:  { from: [0.3, 0, 0.3, 0.7],   to: [0.3, 0.3, 0.3, 0] },
    PLAY:  { from: [1.3, 1.7, 0, 1],     to: [1.3, 1.7, 0.7, 0.3] },
    DRUM:  { from: [0.3, 0, 1.3, 0.7],   to: [0.7, 0.3, 1.3, 0.7] },
    CHOCO: { from: [0.3, 0, 1.7, 0.3],   to: [0.3, 0.3, 1.7, 0.3] }
  };

  var FPCD = {};
  V1.PERSONAS.forEach(function (p) { FPCD[p.code] = p.fpcd.slice(); });
  Object.keys(FPCD_OVERRIDES).forEach(function (code) { FPCD[code] = FPCD_OVERRIDES[code].to.slice(); });

  /* ============ v3 候选批（5 处改动，加粗项见规则文档第一节） ============ */

  var MBTI_TABLE = {
    ENFP: { first: ['DOGG', 'FISH'], second: ['ALIEN', 'DRAMA'] },
    ESFP: { first: ['DOGG', 'DRAMA'], second: ['RUSH', 'PLAY'] },
    ENFJ: { first: ['GUID', 'MAMA'], second: ['DOGG', 'FISH'] },
    ESFJ: { first: ['MAMA', 'DOGG'], second: ['CUPP'] },                 // DOGG 由次选升首选
    ENTP: { first: ['PULL', 'ALIEN'], second: ['PLAY', '2G'] },
    ESTP: { first: ['RUSH', 'PLAY'], second: ['PULL', 'BOSS'] },
    ENTJ: { first: ['BOSS', 'GUID'], second: ['RUSH'] },                 // GUID 由次选升首选
    ESTJ: { first: ['BOSS', 'CUPP'], second: ['GUID', 'ROBOT', 'MAMA'] },
    INFP: { first: ['TEAR', 'FISH'], second: ['2G', 'CHOCO', 'ALIEN'] },
    ISFP: { first: ['FISH', 'CPBR'], second: ['CHOCO', 'CAT'] },
    INFJ: { first: ['TEAR', 'GUID'], second: ['MIND', 'CHOCO'] },
    ISFJ: { first: ['MAMA', 'CUPP'], second: ['CPBR', 'TEAR'] },
    INTP: { first: ['MIND', 'ALIEN', '2G'], second: ['SOLO', 'ROBOT', 'DRUM'] },  // 2G 升首选
    ISTP: { first: ['DRUM', 'CAT', 'SOLO'], second: ['ROBOT'] },                  // SOLO 升首选
    INTJ: { first: ['BOSS', 'CHOCO'], second: ['SOLO', 'MIND', 'CAT'] },
    ISTJ: { first: ['CUPP', 'ROBOT', 'CHOCO'], second: ['SOLO'] }                 // CHOCO 升首选
  };

  /* ============ 打分（元素投票表、星体权重、贴合分公式全部沿用 v1） ============ */

  var TIE_SETS = {
    T: ['MIND', 'BOSS', 'CAT'], F: ['TEAR', 'FISH', 'MAMA'],
    J: ['GUID', 'CUPP', 'ROBOT'], P: ['PULL', 'ALIEN', 'PLAY', '2G']
  };
  var TIER_RANK = { first: 0, second: 1, outside: 2 };
  var EPS = 1e-9;

  function tierOf(batch, code) {
    if (!batch) return 'outside';
    if (batch.first.indexOf(code) >= 0) return 'first';
    if (batch.second.indexOf(code) >= 0) return 'second';
    return 'outside';
  }
  function baseOf(tier) { return tier === 'first' ? FIRST : tier === 'second' ? SECOND : 0; }

  /**
   * v3 主入口。mbti: 'ENFP' 等；chart: V1.computeChart 的返回值；hasTime: 是否有出生时间
   * 返回 { winner, confidence, hidden, board, profile, upset, upsetOver }
   *   winner.tier: 'first' | 'second' | 'outside'  ← 判定路径
   *   upset: 是否由批外翻盘当选
   *   upsetOver: 翻盘时被顶下去的批内胜者（用于文案）
   */
  function computeResult(mbti, chart, hasTime) {
    var profile = V1.computeProfile(chart.placements);
    var batch = MBTI_TABLE[mbti];

    var board = V1.PERSONAS.map(function (p) {
      var tier = tierOf(batch, p.code);
      var base = baseOf(tier);
      var fit = profile ? V1.fitScore(profile, FPCD[p.code]) : 0;
      return { code: p.code, tier: tier, mbtiScore: base, fit: fit, total: base + fit };
    });
    board.sort(function (a, b) { return b.total - a.total; });

    // 并列裁决（v3 补全为确定性规则，不依赖数组书写顺序）
    //   1) MBTI 字母偏好组命中者 → 2) 批内层级更高者 → 3) 贴合分更高者 → 4) 代号字典序
    var prefer = mbti ? [].concat(TIE_SETS[mbti[2]] || [], TIE_SETS[mbti[3]] || []) : [];
    function resolve(pool) {
      return pool.slice().sort(function (a, b) {
        return ((prefer.indexOf(a.code) >= 0 ? 0 : 1) - (prefer.indexOf(b.code) >= 0 ? 0 : 1)) ||
          (TIER_RANK[a.tier] - TIER_RANK[b.tier]) ||
          (b.fit - a.fit) ||
          (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
      })[0];
    }

    // 第一步：批内（首选 + 次选）按总分定胜者 —— MBTI 主锚在这里生效
    var inBatch = board.filter(function (r) { return r.tier !== 'outside'; });
    var winner, upset = false, upsetOver = null;
    if (inBatch.length) {
      var bestTotal = Math.max.apply(null, inBatch.map(function (r) { return r.total; }));
      winner = resolve(inBatch.filter(function (r) { return Math.abs(r.total - bestTotal) < EPS; }));
    } else {
      var bestFitAll = Math.max.apply(null, board.map(function (r) { return r.fit; }));
      winner = resolve(board.filter(function (r) { return Math.abs(r.fit - bestFitAll) < EPS; }));
    }

    // 第二步：批外翻盘（独立覆盖规则）—— 批外贴合分比批内胜者高出 UPSET_MARGIN 以上
    if (profile && inBatch.length) {
      var outside = board.filter(function (r) { return r.tier === 'outside'; });
      if (outside.length) {
        var bestOutFit = Math.max.apply(null, outside.map(function (r) { return r.fit; }));
        if (bestOutFit >= winner.fit + UPSET_MARGIN - EPS) {
          upsetOver = winner;
          winner = resolve(outside.filter(function (r) { return Math.abs(r.fit - bestOutFit) < EPS; }));
          upset = true;
        }
      }
    }

    // 隐藏人设：贴合分全场第一但没当选
    var hidden = null;
    var maxFit = Math.max.apply(null, board.map(function (r) { return r.fit; }));
    if (winner.fit < maxFit - EPS) {
      hidden = board.slice().sort(function (a, b) { return b.fit - a.fit; })
        .filter(function (r) { return r.code !== winner.code; })[0];
    }

    // 置信度（阈值按 v3 分布重新校准）
    var confidence;
    if (!hasTime) confidence = '可能有趣';
    else if (upset) confidence = '值得探索';
    else if (winner.fit >= CONF_STRONG) confidence = '强共鸣';
    else if (winner.fit >= CONF_WORTH) confidence = '值得探索';
    else confidence = '可能有趣';

    return {
      winner: winner, confidence: confidence, hidden: hidden,
      board: board, profile: profile, upset: upset, upsetOver: upsetOver
    };
  }

  return {
    VERSION: 'v3',
    FIRST: FIRST, SECOND: SECOND, UPSET_MARGIN: UPSET_MARGIN,
    CONF_STRONG: CONF_STRONG, CONF_WORTH: CONF_WORTH,
    FPCD: FPCD, FPCD_OVERRIDES: FPCD_OVERRIDES, MBTI_TABLE: MBTI_TABLE,
    computeResult: computeResult
  };
});
