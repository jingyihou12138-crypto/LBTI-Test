/*
 * 恋爱人设测试 v7 核心逻辑（方案 A / 方案 C 共用）
 * 规则来源：../星盘人设映射规则（v7）.md
 * 用 window.SCHEME = 'A' | 'C' 选择星盘打分方案
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./astronomy.browser.min.js'));
  else root.L7 = factory(root.Astronomy);
})(typeof self !== 'undefined' ? self : this, function (Astronomy) {
'use strict';

var SIGNS = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
var FIRE={白羊:1,狮子:1,射手:1}, EARTH={金牛:1,处女:1,摩羯:1}, AIR={双子:1,天秤:1,水瓶:1}, WATER={巨蟹:1,天蝎:1,双鱼:1};
function el(s){ return FIRE[s]?'fire':EARTH[s]?'earth':AIR[s]?'air':'water'; }
function sIdx(l){ var x=l%360; if(x<0)x+=360; return Math.floor(x/30); }

/* ---------- 时区 ---------- */
function tzOff(ms,tz){
  var f=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  var p={}; f.formatToParts(new Date(ms)).forEach(function(x){p[x.type]=x.value;});
  return (Date.UTC(+p.year,+p.month-1,+p.day,p.hour==='24'?0:+p.hour,+p.minute,+p.second)-ms)/60000;
}
function toUTC(y,mo,d,h,mi,tz){
  if(typeof tz==='number') return new Date(Date.UTC(y,mo-1,d,h,mi)-tz*60000);
  var t=Date.UTC(y,mo-1,d,h,mi);
  for(var i=0;i<3;i++){ var o=tzOff(t,tz), t2=Date.UTC(y,mo-1,d,h,mi)-o*60000; if(t2===t)break; t=t2; }
  return new Date(t);
}

/* ---------- 天文 ---------- */
var BODIES=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
var KEY={Sun:'sun',Moon:'moon',Mercury:'mercury',Venus:'venus',Mars:'mars',Jupiter:'jupiter',Saturn:'saturn',Uranus:'uranus',Neptune:'neptune',Pluto:'pluto'};
function lonOf(b,date){
  var t=Astronomy.MakeTime(date);
  if(b==='Moon') return Astronomy.EclipticGeoMoon(t).lon;
  return Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[b],t,true)).elon;
}
function ascMc(date,lat,lng){
  var t=Astronomy.MakeTime(date);
  var gst=Astronomy.SiderealTime(t);                 // 小时
  var lst=(gst+lng/15)*15*Math.PI/180;               // 弧度
  var e=23.4392911*Math.PI/180, la=lat*Math.PI/180;
  var asc=Math.atan2(Math.cos(lst), -(Math.sin(lst)*Math.cos(e)+Math.tan(la)*Math.sin(e)))*180/Math.PI;
  if(asc<0)asc+=360;
  var mc=Math.atan2(Math.sin(lst),Math.cos(lst)*Math.cos(e))*180/Math.PI;
  if(mc<0)mc+=360;
  return {asc:asc,mc:mc};
}
function chart(inp){
  var utc=toUTC(inp.year,inp.month,inp.day,inp.hasTime?inp.hour:12,inp.hasTime?inp.minute:0,inp.tz);
  var lon={}, sg={};
  BODIES.forEach(function(b){ var L=lonOf(b,utc); lon[KEY[b]]=L; sg[KEY[b]]=SIGNS[sIdx(L)]; });
  var houses={}, moonUnstable=false;
  if(inp.hasTime){
    var a=ascMc(utc,inp.lat,inp.lng);
    lon.asc=a.asc; lon.mc=a.mc; lon.dsc=(a.asc+180)%360;
    sg.asc=SIGNS[sIdx(a.asc)]; sg.mc=SIGNS[sIdx(a.mc)]; sg.dsc=SIGNS[sIdx(lon.dsc)];
    BODIES.forEach(function(b){                       // 等宫制
      var d=(lon[KEY[b]]-a.asc+360)%360;
      houses[KEY[b]]=Math.floor(d/30)+1;
    });
  } else {
    var m0=sIdx(lonOf('Moon',toUTC(inp.year,inp.month,inp.day,0,1,inp.tz)));
    var m1=sIdx(lonOf('Moon',toUTC(inp.year,inp.month,inp.day,23,59,inp.tz)));
    moonUnstable = m0!==m1;
  }
  // 相位
  var ORB={'合':[0,7],'刑':[90,6],'冲':[180,7],'拱':[120,6],'六合':[60,4]};
  var keys=Object.keys(lon), asp=[];
  for(var i=0;i<keys.length;i++) for(var j=i+1;j<keys.length;j++){
    var dd=Math.abs(lon[keys[i]]-lon[keys[j]])%360; if(dd>180)dd=360-dd;
    for(var n in ORB){ if(Math.abs(dd-ORB[n][0])<=ORB[n][1]){ asp.push([keys[i],keys[j],n]); break; } }
  }
  return {lon:lon,sg:sg,houses:houses,asp:asp,hasTime:inp.hasTime,moonUnstable:moonUnstable};
}

/* ---------- 相位/宫位查询 ---------- */
var HARD={'合':1,'刑':1,'冲':1};
function mkQ(ch){
  function A(x,y,kind){
    for(var i=0;i<ch.asp.length;i++){ var a=ch.asp[i];
      if((a[0]===x&&a[1]===y)||(a[0]===y&&a[1]===x)){
        if(kind==='hard') { if(HARD[a[2]]) return a[2]; }
        else if(kind==='soft'){ if(!HARD[a[2]]) return a[2]; }
        else return a[2];
      } }
    return null;
  }
  function inh(n){ var r=[]; for(var k in ch.houses) if(ch.houses[k]===n) r.push(k); return r; }
  return {A:A, inh:inh, h:function(p){return ch.houses[p];}, sg:ch.sg};
}

/* ---------- 12 维打分（星盘 → 用户画像） ---------- */
var DIM=['上头','心动','慕强','推进','表达','推拉','亲密','占有','精神','焦虑','回避','引导'];
var SPD={白羊:4,狮子:4,射手:4,双子:3,天秤:3,水瓶:3,巨蟹:1,天蝎:1,双鱼:1,金牛:.5,处女:.5,摩羯:.5};
var PSH={白羊:4,狮子:3.5,射手:3.5,摩羯:3,双子:2.5,天秤:2.5,水瓶:2.5,金牛:2,处女:2,天蝎:2,巨蟹:1,双鱼:.5};
var EXP={白羊:3.5,狮子:3.5,射手:3.5,双子:2.5,天秤:2.5,水瓶:2.5,巨蟹:2.5,摩羯:1.5,处女:1.5,金牛:1.5,天蝎:.5,双鱼:.5};
var RULER={白羊:'mars',金牛:'venus',双子:'mercury',巨蟹:'moon',狮子:'sun',处女:'mercury',天秤:'venus',天蝎:'pluto',射手:'jupiter',摩羯:'saturn',水瓶:'uranus',双鱼:'neptune'};
function cl(x){ return Math.max(0,Math.min(4,x)); }

function profile(ch,mbti){
  var q=mkQ(ch), sg=ch.sg, A=q.A, h=q.h, inh=q.inh, U={};
  var hasT=ch.hasTime;
  var stel1 = hasT && inh(1).length>=3;
  var E=mbti?(mbti[0]==='E'?1:-1):0, N=mbti?(mbti[1]==='N'?1:-1):0,
      Fv=mbti?(mbti[2]==='F'?1:-1):0, Pv=mbti?(mbti[3]==='P'?1:-1):0;

  // 1 上头
  var ws=[['mars',.35],['asc',.20],['sun',.15],['moon',.15],['venus',.15]], s=0,tw=0,fw=0;
  ws.forEach(function(w){ fw+=w[1]; if(sg[w[0]]){ s+=SPD[sg[w[0]]]*w[1]; tw+=w[1]; } });
  var v = tw? s/tw*fw : 2;
  if(A('venus','mars')) v+=1;
  if(stel1) v+=.5;
  if(A('venus','saturn','hard')) v-=1;
  U['上头']=cl(v);

  // 2 心动（浪漫）
  var VB={双鱼:4,巨蟹:3,射手:3,天蝎:2.5,白羊:2,狮子:2,双子:2,天秤:2,水瓶:2,金牛:1,处女:1,摩羯:0};
  v=VB[sg.venus];
  if(A('venus','neptune','hard'))v+=1; else if(A('venus','neptune','soft'))v+=.75;
  if(A('venus','saturn','hard'))v-=1.5; else if(A('venus','saturn','soft'))v-=1;
  if(EARTH[sg.moon])v-=.5;
  U['心动']=cl(v+.3*N+.3*Fv);

  // 3 慕强
  v=2;
  if(sg.venus==='摩羯'||sg.venus==='天蝎'||sg.venus==='狮子')v+=.5;
  if(sg.venus==='双鱼'||sg.venus==='巨蟹')v-=.5;
  if(A('venus','saturn'))v+=1.5;
  if(A('venus','pluto'))v+=1.5;
  if(hasT){
    if(inh(7).indexOf('saturn')>=0)v+=.5;
    if(inh(7).indexOf('pluto')>=0)v+=.5;
    if(h(RULER[sg.dsc])===10 || h(RULER[sg.mc])===7) v+=.75;
    if(sg.dsc==='摩羯'||sg.dsc==='天蝎'||sg.dsc==='狮子')v+=.25;
  }
  U['慕强']=cl(v);

  // 4 推进
  ws=[['mars',.35],['asc',.25],['sun',.25],['moon',.15]]; s=0;tw=0;fw=0;
  ws.forEach(function(w){ fw+=w[1]; if(sg[w[0]]){ s+=PSH[sg[w[0]]]*w[1]; tw+=w[1]; } });
  v = tw? s/tw*fw : 2;
  if(stel1)v+=1;
  if(hasT && (h('mars')===1||h('mars')===10))v+=.5;
  if(hasT && h('mars')===12)v-=2;
  U['推进']=cl(v+.4*E);

  // 5 表达
  ws=[['mercury',.30],['venus',.25],['asc',.25]]; s=0;tw=0;fw=0;
  ws.forEach(function(w){ fw+=w[1]; if(sg[w[0]]){ s+=EXP[sg[w[0]]]*w[1]; tw+=w[1]; } });
  v = tw? s/tw*fw : 2;
  var leak = FIRE[sg.moon] || (hasT&&h('moon')===1) || A('moon','asc') || A('moon','mc');
  var hide = sg.moon==='天蝎'||sg.moon==='摩羯'||(hasT&&(h('moon')===8||h('moon')===12));
  if(leak)v+=1; if(hide)v-=1;
  if(A('venus','saturn','hard'))v-=1.5;
  if(A('mercury','saturn','hard'))v-=.75;
  if(stel1)v+=.5;
  U['表达']=cl(v+.4*E);

  // 6 推拉
  v=1;
  var vu=A('venus','uranus'); if(vu){ v += HARD[vu]?2:1; }
  if(AIR[sg.venus])v+=1;
  if(sg.venus==='天蝎')v+=.5;
  if(AIR[sg.mars])v+=.5;
  if(sg.moon==='水瓶'||sg.moon==='双子')v+=.5;
  if(A('venus','mars','hard'))v+=.5;
  if(hasT && (inh(5).indexOf('uranus')>=0||inh(5).indexOf('mercury')>=0))v+=.5;
  if((sg.venus==='巨蟹'||sg.venus==='金牛'||sg.venus==='摩羯') && (EARTH[sg.moon]||WATER[sg.moon])) v=Math.min(v,1);
  U['推拉']=cl(v+.3*Pv);

  // 7 亲密
  var MB={巨蟹:4,天蝎:4,双鱼:4,金牛:3.5,狮子:3.5,摩羯:3,白羊:2,天秤:2,处女:2,射手:1,双子:1,水瓶:.5};
  v=MB[sg.moon];
  var mp=A('moon','pluto'); if(mp) v += HARD[mp]?1.5:.75;
  if(A('moon','venus'))v+=.5;
  if(A('moon','sun','hard'))v+=.5;
  ['venus','mars'].forEach(function(p){ if(sg[p]==='天蝎'||sg[p]==='金牛')v+=.5; });
  if(hasT){ var mh=h('moon');
    if(mh===4||mh===7||mh===8||mh===12)v+=1;
    if(mh===1)v+=.5;
    if(mh===9||mh===10||mh===11)v-=1; }
  U['亲密']=cl(v);

  // 8 占有
  var vp=A('venus','pluto');
  v = vp ? (HARD[vp]?4:2.5) : 1;
  if(hasT){ var h8=inh(8);
    if(h8.indexOf('venus')>=0||h8.indexOf('moon')>=0)v+=1.5; else if(h8.length)v+=.5; }
  if(sg.sun==='天蝎'||sg.moon==='天蝎'||sg.venus==='天蝎')v+=1;
  if(A('venus','saturn','hard')||A('moon','saturn','hard'))v+=1;
  U['占有']=cl(v);

  // 9 精神
  v=1.5;
  if(hasT){ var h9=inh(9);
    if(h9.indexOf('sun')>=0||h9.indexOf('moon')>=0||h9.indexOf('venus')>=0)v+=1.5;
    var r9=RULER[SIGNS[sIdx((ch.lon.asc+240)%360)]];
    if(r9&&(h(r9)===1||h(r9)===9||h(r9)===10))v+=.25;
    if(h('mercury')===3||h('mercury')===9)v+=.5; else if(AIR[sg.mercury])v+=.25;
    if(inh(12).length)v+=.5;
  } else if(AIR[sg.mercury]) v+=.25;
  if(sg.mercury===sg.venus||A('venus','mercury'))v+=1;
  if(A('moon','mercury'))v+=.5;
  if(A('venus','neptune')||A('moon','neptune'))v+=.25;
  if(sg.venus==='水瓶'||sg.venus==='双子'||sg.venus==='双鱼')v+=.25;
  if(sg.venus==='金牛'||sg.venus==='巨蟹'||sg.venus==='摩羯')v-=.25;
  if(sg.moon==='水瓶'||sg.moon==='双子'||sg.moon==='射手')v+=.25;
  if(sg.moon==='金牛'||sg.moon==='巨蟹')v-=.25;
  U['精神']=cl(v+.4*N);

  // 10 焦虑 / 11 回避
  var v9=.5, v10=.5;
  var mt=A('moon','saturn','hard'), mu=A('moon','uranus');
  var avoidSig = (mu&&HARD[mu]) || (hasT&&(h('moon')===10||h('moon')===11));
  if(mt){ if(avoidSig){ v9+=1; v10+=1; } else { v9+=2; v10+=.3; } }
  else if(A('moon','saturn','soft')) v9+=.5;
  if(A('moon','pluto','hard'))v9+=1.5;
  if(A('venus','saturn','hard'))v9+=1;
  if(sg.moon==='天蝎'||sg.moon==='处女')v9+=.5;
  if(hasT&&h('moon')===12)v9+=.5;
  if(hasT&&inh(4).indexOf('saturn')>=0)v9+=.5;
  if(mu){ v10 += HARD[mu]?2:.5; }
  if(sg.moon==='水瓶'||sg.moon==='摩羯')v10+=1;
  if(hasT&&(h('moon')===10||h('moon')===11))v10+=1;
  if(sg.asc==='摩羯'||sg.asc==='水瓶')v10+=.5;
  if(hasT&&h('mars')===12)v10+=.5;
  var rev=0;
  if(A('moon','jupiter','soft')||A('moon','venus','soft'))rev+=1;
  if(hasT&&(inh(4).indexOf('venus')>=0||inh(4).indexOf('jupiter')>=0))rev+=.5;
  v9-=rev; v10-=rev*.5;
  var tight=false;
  ['saturn','uranus','pluto'].forEach(function(p){ var a=A('moon',p,'hard'); if(a)tight=true; });
  if(!tight) v9=Math.min(v9,2);
  U['焦虑']=cl(v9+.3*Fv); U['回避']=cl(v10+.3*Pv);

  // 12 引导
  var SB={摩羯:3.5,狮子:3,天蝎:3,白羊:2.5,金牛:2.5,处女:2.5,天秤:2,射手:2,水瓶:2,双子:1,巨蟹:1,双鱼:1};
  v=SB[sg.sun];
  if(A('sun','saturn','soft')||A('moon','saturn','soft'))v+=1;
  if(A('sun','saturn','hard')||A('moon','saturn','hard'))v-=1;
  if(sg.asc==='摩羯'||sg.asc==='天蝎'||sg.asc==='狮子')v+=.5;
  if(sg.asc==='巨蟹'||sg.asc==='双鱼')v-=.5;
  if(hasT&&inh(10).length)v+=.5;
  U['引导']=cl(v-.3*Pv);

  return U;
}

/* ---------- 人设 12 维（取自图鉴 12 维码，H=4/M=2/L=0） ---------- */
var CODES={DOGG:'HHM-HHM-HHM-MML',TEAR:'MHH-MMM-HHM-HML',DRUM:'LML-LLL-MMH-LHL',CUPP:'LLM-MML-MLL-LLM',
PULL:'MHM-HMH-MHM-MHL',RUSH:'HMM-HHL-MML-LLM',GUID:'MLM-HML-MML-LLH',SOLO:'LML-LLL-LLM-LHL',
ALIEN:'LHM-MLM-MMH-LML',BOSS:'MLH-HMM-MMM-LLH',FISH:'HMM-MML-MMH-MLL',MAMA:'MHL-MML-HHM-MLM',
PLAY:'HMM-HHM-LLL-LHM',ROBOT:'LML-MLM-LLM-LLM',DRAMA:'HHH-MHM-HHM-HHM',CAT:'MHM-MLM-LHM-LLM',
CHOCO:'LLM-LLL-HHM-LLM',CPBR:'MMM-MMM-MMM-MMM',MIND:'MMM-MMM-MHM-HLM','2G':'MLM-MLL-MLM-LML'};
var HV={H:4,M:2,L:0}, PVEC={};
for(var c in CODES) PVEC[c]=CODES[c].replace(/-/g,'').split('').map(function(x){return HV[x];});
var W=[1.0,0.8,1.0,1.2,1.2,1.2,1.5,1.0,0.8,1.5,1.5,1.2];

/* ---------- MBTI 候选批（v7） ---------- */
var BATCH={
ISFJ:[['MAMA','TEAR','CUPP','CPBR','MIND'],['CHOCO','ROBOT']],
ESFJ:[['MAMA','DOGG','DRAMA','PLAY'],['CUPP','GUID']],
ISTJ:[['CUPP','ROBOT','CHOCO','GUID'],['SOLO','MIND']],
ISFP:[['FISH','CAT','CPBR','MAMA'],['CHOCO','TEAR']],
ESTJ:[['BOSS','CUPP','GUID'],['MAMA','CHOCO','ROBOT']],
ESFP:[['DOGG','DRAMA','RUSH','PULL','PLAY'],['FISH','CPBR']],
ENFP:[['DOGG','FISH','DRAMA'],['PULL','TEAR','ALIEN']],
ISTP:[['DRUM','CAT','SOLO','2G'],['ROBOT','CHOCO']],
INFP:[['TEAR','FISH','SOLO'],['2G','CHOCO','ALIEN','DRAMA']],
ESTP:[['RUSH','PLAY','PULL'],['BOSS','DOGG']],
INTP:[['MIND','ALIEN','2G','DRUM'],['SOLO','ROBOT','CAT']],
ENTP:[['PULL','PLAY'],['2G','RUSH','BOSS','ALIEN']],
ENFJ:[['GUID','MAMA','DOGG'],['FISH','DRAMA','TEAR']],
INTJ:[['BOSS','CHOCO','CAT','MIND','ALIEN'],['SOLO','GUID','2G']],
ENTJ:[['BOSS','GUID','RUSH'],['PULL','CHOCO','CAT']],
INFJ:[['TEAR','ALIEN','GUID','MIND'],['CHOCO','MAMA','2G']]};

/* ---------- 方案 C：直接星盘签名 ---------- */
var SIG={
DOGG:[['fire_sun_moon_asc',1.5],['moon_h1',1],['venus_mars_asp',1],['moon_fire',1],['moon_saturn_hard',-1],['moon_aqu_cap',-1.5],['venus_earth',-1]],
TEAR:[['moon_water',1.5],['moon_saturn_hard',1],['moon_pluto_hard',1],['venus_neptune',1],['h12_planets',1],['mars_fire',-1],['moon_fire',-1]],
DRUM:[['moon_uranus',1],['moon_saturn_hard',1],['mars_h12',1.5],['mars_water',1],['asc_water_earth',.5],['mars_fire',-1.5],['stel1',-1]],
CUPP:[['moon_earth',1.5],['venus_earth',1],['mars_earth',1],['no_hard_moon',1],['moon_water',-1],['venus_pluto',-1.5]],
PULL:[['venus_uranus',2],['venus_air',1],['mars_air',1],['h5_uranus_mercury',1],['venus_mars_hard',.5],['moon_water',-1],['venus_earth',-1]],
RUSH:[['mars_fire',2],['asc_fire',1],['sun_fire',1],['venus_fire',1],['mars_h12',-2],['venus_saturn_hard',-1.5],['mars_water',-1]],
GUID:[['saturn_sun_moon_soft',1.5],['sun_cap_leo_sco',1],['asc_cap_sco_leo',1],['h10_planets',1],['saturn_sun_moon_hard',-1.5],['moon_saturn_hard',-1]],
SOLO:[['moon_aqu_cap',1.5],['moon_h9_10_11',1],['venus_saturn_hard',1],['mars_earth',.5],['h8_empty',.5],['moon_water',-1.5],['stel1',-1]],
ALIEN:[['uranus_strong',1.5],['venus_air',1],['moon_air',1],['mercury_air',1],['h9_planets',1],['moon_earth',-1],['venus_earth',-1]],
BOSS:[['venus_saturn',1.5],['venus_pluto',1.5],['sat_h7',1],['sun_cap_leo_sco',1],['venus_cap_sco_leo',1],['venus_pis_can',-1.5]],
FISH:[['venus_neptune',1.5],['moon_water',1],['venus_water',1],['mars_water',1],['h12_planets',.5],['venus_saturn_hard',-1],['moon_aqu_cap',-1.5]],
MAMA:[['moon_can_tau_vir',1.5],['moon_h4',1],['venus_earth',1],['moon_venus_asp',1],['moon_aqu_cap',-1.5],['venus_uranus',-1]],
PLAY:[['venus_air',1],['mars_fire_air',1],['venus_uranus',1],['h11_planets',1],['moon_air',1],['moon_water',-1.5],['venus_pluto',-1]],
ROBOT:[['mercury_earth',1.5],['venus_earth',1],['mercury_saturn_hard',1],['venus_saturn_hard',1],['mars_earth',.5],['mercury_fire_air',-1],['stel1',-1]],
DRAMA:[['moon_pluto_hard',1.5],['venus_pluto',1.5],['moon_water',1],['h8_planets',1],['sco_strong',1],['moon_jupiter_soft',-1],['moon_air',-1]],
CAT:[['moon_aqu_cap',1],['venus_sco',1],['moon_uranus',1],['asc_earth_air',.5],['mars_water',.5],['stel1',-1],['moon_can_tau_vir',-1]],
CHOCO:[['venus_sco_cap',1.5],['moon_water',1],['venus_saturn_hard',1],['mercury_saturn_hard',1],['moon_h8_12',1],['asc_fire',-1],['stel1',-1]],
CPBR:[['no_hard_moon',2],['moon_jupiter_soft',1],['h4_benefic',1],['balanced_elements',1],['moon_pluto_hard',-1.5],['moon_saturn_hard',-1],['venus_pluto',-1]],
MIND:[['mercury_h3_9',1],['moon_mercury_asp',1.5],['mercury_air',1],['moon_saturn_hard',1],['h9_planets',1],['mars_fire',-1]],
'2G':[['moon_uranus',1.5],['moon_air',1],['venus_air',1],['moon_h9_10_11',1],['mars_h12',.5],['moon_water',-1],['stel1',-1]]};

function feats(ch){
  var q=mkQ(ch), sg=ch.sg, A=q.A, h=q.h, inh=q.inh, T=ch.hasTime, f={};
  var cnt={fire:0,earth:0,air:0,water:0};
  ['sun','moon','mercury','venus','mars'].forEach(function(p){ cnt[el(sg[p])]++; });
  var b=function(x){return x?1:0;};
  var fa=['sun','moon','asc'].filter(function(k){return sg[k]&&FIRE[sg[k]];}).length;
  f.fire_sun_moon_asc = fa/(T?3:2)*2;
  f.moon_h1=b(T&&h('moon')===1); f.moon_fire=b(FIRE[sg.moon]); f.moon_water=b(WATER[sg.moon]);
  f.moon_earth=b(EARTH[sg.moon]); f.moon_air=b(AIR[sg.moon]);
  f.moon_aqu_cap=b(sg.moon==='水瓶'||sg.moon==='摩羯');
  f.moon_can_tau_vir=b(sg.moon==='巨蟹'||sg.moon==='金牛'||sg.moon==='处女');
  f.venus_earth=b(EARTH[sg.venus]); f.venus_air=b(AIR[sg.venus]); f.venus_water=b(WATER[sg.venus]); f.venus_fire=b(FIRE[sg.venus]);
  f.venus_sco=b(sg.venus==='天蝎'); f.venus_sco_cap=b(sg.venus==='天蝎'||sg.venus==='摩羯');
  f.venus_cap_sco_leo=b(sg.venus==='摩羯'||sg.venus==='天蝎'||sg.venus==='狮子');
  f.venus_pis_can=b(sg.venus==='双鱼'||sg.venus==='巨蟹');
  f.mars_fire=b(FIRE[sg.mars]); f.mars_water=b(WATER[sg.mars]); f.mars_earth=b(EARTH[sg.mars]); f.mars_air=b(AIR[sg.mars]);
  f.mars_fire_air=b(FIRE[sg.mars]||AIR[sg.mars]); f.mars_h12=b(T&&h('mars')===12);
  f.mercury_air=b(AIR[sg.mercury]); f.mercury_earth=b(EARTH[sg.mercury]);
  f.mercury_fire_air=b(FIRE[sg.mercury]||AIR[sg.mercury]); f.mercury_h3_9=b(T&&(h('mercury')===3||h('mercury')===9));
  f.asc_fire=b(T&&FIRE[sg.asc]); f.asc_water_earth=b(T&&(WATER[sg.asc]||EARTH[sg.asc]));
  f.asc_earth_air=b(T&&(EARTH[sg.asc]||AIR[sg.asc])); f.asc_cap_sco_leo=b(T&&(sg.asc==='摩羯'||sg.asc==='天蝎'||sg.asc==='狮子'));
  f.sun_fire=b(FIRE[sg.sun]); f.sun_cap_leo_sco=b(sg.sun==='摩羯'||sg.sun==='狮子'||sg.sun==='天蝎');
  f.venus_mars_asp=b(A('venus','mars')); f.venus_mars_hard=b(A('venus','mars','hard'));
  f.venus_uranus=b(A('venus','uranus')); f.venus_neptune=b(A('venus','neptune'));
  f.venus_pluto=b(A('venus','pluto')); f.venus_saturn=b(A('venus','saturn')); f.venus_saturn_hard=b(A('venus','saturn','hard'));
  f.moon_saturn_hard=b(A('moon','saturn','hard')); f.moon_pluto_hard=b(A('moon','pluto','hard'));
  f.moon_uranus=b(A('moon','uranus')); f.moon_venus_asp=b(A('moon','venus'));
  f.moon_mercury_asp=b(A('moon','mercury')); f.moon_jupiter_soft=b(A('moon','jupiter','soft'));
  f.mercury_saturn_hard=b(A('mercury','saturn','hard'));
  f.saturn_sun_moon_soft=b(A('sun','saturn','soft')||A('moon','saturn','soft'));
  f.saturn_sun_moon_hard=b(A('sun','saturn','hard')||A('moon','saturn','hard'));
  f.no_hard_moon=b(!(A('moon','saturn','hard')||A('moon','uranus','hard')||A('moon','pluto','hard')));
  f.moon_h4=b(T&&h('moon')===4); f.moon_h8_12=b(T&&(h('moon')===8||h('moon')===12));
  f.moon_h9_10_11=b(T&&(h('moon')===9||h('moon')===10||h('moon')===11));
  f.h12_planets=b(T&&inh(12).length); f.h9_planets=b(T&&inh(9).length); f.h10_planets=b(T&&inh(10).length);
  f.h11_planets=b(T&&inh(11).length); f.h8_planets=b(T&&inh(8).length); f.h8_empty=b(T&&!inh(8).length);
  f.h4_benefic=b(T&&(inh(4).indexOf('venus')>=0||inh(4).indexOf('jupiter')>=0));
  f.h5_uranus_mercury=b(T&&(inh(5).indexOf('uranus')>=0||inh(5).indexOf('mercury')>=0));
  f.stel1=b(T&&inh(1).length>=3); f.sat_h7=b(T&&inh(7).indexOf('saturn')>=0);
  f.uranus_strong=b((T&&[1,3,9,11].indexOf(h('uranus'))>=0)||A('moon','uranus')||A('venus','uranus'));
  f.sco_strong=b(['sun','moon','venus','mars'].some(function(p){return sg[p]==='天蝎';}));
  f.balanced_elements=b(Math.max(cnt.fire,cnt.earth,cnt.air,cnt.water)<=2);
  return f;
}

/* ---------- 打分 ---------- */
function simA(u,code,dims,sw){
  var s=0; dims.forEach(function(i){ s+=W[i]*Math.abs(u[i]-PVEC[code][i]); });
  return 100*(1-s/(4*sw));
}
function simC(ft,code){
  var rs=SIG[code], s=0, mx=0;
  rs.forEach(function(r){ s+=r[1]*(ft[r[0]]||0); mx+=Math.abs(r[1]); });
  return mx? 50+50*s/mx : 50;
}

function judge(U,mbti,ft,scheme){
  var u=DIM.map(function(d){return U[d];});
  var B=BATCH[mbti]||[Object.keys(PVEC),[]];
  var F=B[0], S=B[1].filter(function(c){return F.indexOf(c)<0;});
  var pool=F.concat(S);
  var dims=[], sw=0;
  for(var i=0;i<12;i++){ var set={}; pool.forEach(function(c){set[PVEC[c][i]]=1;});
    if(Object.keys(set).length>1){ dims.push(i); sw+=W[i]; } }
  if(!dims.length){ for(i=0;i<12;i++){dims.push(i);sw+=W[i];} }
  var chart={};
  Object.keys(PVEC).forEach(function(c){
    chart[c] = scheme==='C' ? simC(ft,c) : simA(u,c,dims,sw);
  });
  var board=Object.keys(PVEC).map(function(c){
    var base = F.indexOf(c)>=0?100:(S.indexOf(c)>=0?50:0);
    return {code:c, chart:chart[c], base:base, total:base+chart[c]};
  }).sort(function(a,b){return b.total-a.total;});
  var inF=board.filter(function(r){return F.indexOf(r.code)>=0;});
  var gap = inF.length>1 ? inF[0].chart-inF[1].chart : 99;
  return {winner:board[0], board:board, inF:inF, gap:gap, F:F, S:S,
          hidden: board.filter(function(r){return r.code!==board[0].code;})
                       .sort(function(a,b){return b.chart-a.chart;})[0]};
}

function confidence(res,ch){
  if(!ch.hasTime) return '可能有趣';
  if(ch.moonUnstable) return '可能有趣';
  return res.gap>=8 ? '强共鸣' : '值得探索';
}

return {SIGNS:SIGNS, DIM:DIM, PVEC:PVEC, BATCH:BATCH, chart:chart, profile:profile,
        feats:feats, judge:judge, confidence:confidence, toUTC:toUTC};
});
