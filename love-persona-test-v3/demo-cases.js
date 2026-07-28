/*
 * 快捷试玩案例 —— 页面与验证脚本共用的唯一来源
 * 每条的 expect 都由 脚本/verify_v3_page.mjs 实测核对，改动这里会被验证脚本抓到。
 *   expect.v1 / expect.v3：两版当选人设代号
 *   expect.upset：v3 是否走批外翻盘
 * UMD：浏览器挂 window.DemoCases；node 可 require。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DemoCases = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return [
    { group: 'MBTI 主锚：两版结果一致',
      label: '本人 ENFP · 2002-12-05 07:05 唐山',
      mbti: 'ENFP', y: 2002, mo: 12, d: 5, h: 7, mi: 5, prov: '河北省', city: '唐山市',
      note: '两版都是 狗勾。v2 曾把它翻成抓马，v3 改回来了',
      expect: { v1: 'DOGG', v3: 'DOGG', upset: false } },

    { group: 'MBTI 主锚：两版结果一致',
      label: 'ISFP · 2002-09-10 06:10 唐山',
      mbti: 'ISFP', y: 2002, mo: 9, d: 10, h: 6, mi: 10, prov: '河北省', city: '唐山市',
      note: '两版都是 卡皮巴拉，强共鸣',
      expect: { v1: 'CPBR', v3: 'CPBR', upset: false } },

    { group: '⚡ 星盘翻盘（v3 独有，全人群 2.66%）',
      label: 'ISTJ · 1990-11-25 21:30 广州',
      mbti: 'ISTJ', y: 1990, mo: 11, d: 25, h: 21, mi: 30, prov: '广东省', city: '广州市',
      note: '保温杯 → 林黛玉。务实型撞上一张全是水的盘',
      expect: { v1: 'CUPP', v3: 'TEAR', upset: true } },

    { group: '⚡ 星盘翻盘（v3 独有，全人群 2.66%）',
      label: 'ENTJ · 1992-11-05 09:30 广州',
      mbti: 'ENTJ', y: 1992, mo: 11, d: 5, h: 9, mi: 30, prov: '广东省', city: '广州市',
      note: '王者 → 抓马。指挥官型被星盘判成虐恋情深',
      expect: { v1: 'BOSS', v3: 'DRAMA', upset: true } },

    { group: '⚡ 星盘翻盘（v3 独有，全人群 2.66%）',
      label: 'ESFP · 1990-02-05 03:30 广州',
      mbti: 'ESFP', y: 1990, mo: 2, d: 5, h: 3, mi: 30, prov: '广东省', city: '广州市',
      note: '狗勾 → 引导型',
      expect: { v1: 'DOGG', v3: 'GUID', upset: true } },

    { group: '结构修复：v1 里赢不了的人设现在能赢了',
      label: 'ISTP · 1992-09-08 08:20 广州',
      mbti: 'ISTP', y: 1992, mo: 9, d: 8, h: 8, mi: 20, prov: '广东省', city: '广州市',
      note: '猫 → 寡王。SOLO 在 v1 占比恒为 0，v3 升为 ISTP 首选',
      expect: { v1: 'CAT', v3: 'SOLO', upset: false } },

    { group: '结构修复：v1 里赢不了的人设现在能赢了',
      label: 'INTP · 1992-01-08 08:20 广州',
      mbti: 'INTP', y: 1992, mo: 1, d: 8, h: 8, mi: 20, prov: '广东省', city: '广州市',
      note: '外星人 → 2G 失联者。2G 在 v1 也是恒 0，v3 升为 INTP 首选',
      expect: { v1: 'ALIEN', v3: '2G', upset: false } },

    { group: '结构修复：v1 里赢不了的人设现在能赢了',
      label: 'ISTJ · 1992-01-18 20:20 广州',
      mbti: 'ISTJ', y: 1992, mo: 1, d: 18, h: 20, mi: 20, prov: '广东省', city: '广州市',
      note: '保温杯 → 酒心巧克力。v1 下 ISTJ 结果 100% 是保温杯，星盘完全不起作用',
      expect: { v1: 'CUPP', v3: 'CHOCO', upset: false } },

    { group: '结构修复：v1 里赢不了的人设现在能赢了',
      label: 'ESFJ · 1992-01-08 02:20 广州',
      mbti: 'ESFJ', y: 1992, mo: 1, d: 8, h: 2, mi: 20, prov: '广东省', city: '广州市',
      note: '妈妈 → 狗勾。v1 下 ESFJ 结果 100% 是妈妈',
      expect: { v1: 'MAMA', v3: 'DOGG', upset: false } }
  ];
});
