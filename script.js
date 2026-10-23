import { firebaseConfig } from './firebase-config.js';
import { rnd, rollExpr } from './dice.js';

/* =====================================================================
   helpers
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => e.append(c ?? ''));
  return e;
}

const store = {
  get(k, d) {
    try { const v = localStorage.getItem('dndtable.' + k); return v ? JSON.parse(v) : d; } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem('dndtable.' + k, JSON.stringify(v)); } catch { /* เต็ม/ปิดไว้ */ }
  },
};
const uid8 = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const bonusExpr = b => `1d20${b >= 0 ? '+' : '-'}${Math.abs(b)}`;
const safeColor = c => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#888888');

let toastT;
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

/* =====================================================================
   ข้อมูลกฎ
   ===================================================================== */
const ABILITIES = [
  { k: 'str', th: 'กำลัง', en: 'STR' },
  { k: 'dex', th: 'คล่องแคล่ว', en: 'DEX' },
  { k: 'con', th: 'ทนทาน', en: 'CON' },
  { k: 'int', th: 'ปัญญา', en: 'INT' },
  { k: 'wis', th: 'รอบรู้', en: 'WIS' },
  { k: 'cha', th: 'เสน่ห์', en: 'CHA' },
];

// hd = hit die, saves = เซฟที่ชำนาญ, pri = ลำดับสถานะที่ควรลงแต้มสูงสุดก่อน
const CLASSES = {
  Barbarian: { th: 'บาร์บาเรียน', hd: 12, saves: ['str', 'con'], pri: ['str', 'con', 'dex', 'wis', 'cha', 'int'] },
  Bard:      { th: 'บาร์ด', hd: 8, saves: ['dex', 'cha'], pri: ['cha', 'dex', 'con', 'wis', 'int', 'str'] },
  Cleric:    { th: 'เคลอริก', hd: 8, saves: ['wis', 'cha'], pri: ['wis', 'con', 'str', 'cha', 'dex', 'int'] },
  Druid:     { th: 'ดรูอิด', hd: 8, saves: ['int', 'wis'], pri: ['wis', 'con', 'dex', 'int', 'cha', 'str'] },
  Fighter:   { th: 'ไฟเตอร์', hd: 10, saves: ['str', 'con'], pri: ['str', 'con', 'dex', 'wis', 'cha', 'int'] },
  Monk:      { th: 'มังค์', hd: 8, saves: ['str', 'dex'], pri: ['dex', 'wis', 'con', 'str', 'int', 'cha'] },
  Paladin:   { th: 'พาลาดิน', hd: 10, saves: ['wis', 'cha'], pri: ['str', 'cha', 'con', 'wis', 'dex', 'int'] },
  Ranger:    { th: 'เรนเจอร์', hd: 10, saves: ['str', 'dex'], pri: ['dex', 'wis', 'con', 'str', 'int', 'cha'] },
  Rogue:     { th: 'โรก', hd: 8, saves: ['dex', 'int'], pri: ['dex', 'con', 'int', 'cha', 'wis', 'str'] },
  Sorcerer:  { th: 'ซอร์เซอเรอร์', hd: 6, saves: ['con', 'cha'], pri: ['cha', 'con', 'dex', 'wis', 'int', 'str'] },
  Warlock:   { th: 'วอร์ล็อก', hd: 8, saves: ['wis', 'cha'], pri: ['cha', 'con', 'dex', 'wis', 'int', 'str'] },
  Wizard:    { th: 'วิซาร์ด', hd: 6, saves: ['int', 'wis'], pri: ['int', 'con', 'dex', 'wis', 'cha', 'str'] },
};

const SKILLS = [
  { k: 'acrobatics', th: 'กายกรรม', en: 'Acrobatics', ab: 'dex' },
  { k: 'animal', th: 'ดูแลสัตว์', en: 'Animal Handling', ab: 'wis' },
  { k: 'arcana', th: 'เวทมนตร์', en: 'Arcana', ab: 'int' },
  { k: 'athletics', th: 'กรีฑา', en: 'Athletics', ab: 'str' },
  { k: 'deception', th: 'หลอกลวง', en: 'Deception', ab: 'cha' },
  { k: 'history', th: 'ประวัติศาสตร์', en: 'History', ab: 'int' },
  { k: 'insight', th: 'หยั่งรู้', en: 'Insight', ab: 'wis' },
  { k: 'intimidation', th: 'ข่มขู่', en: 'Intimidation', ab: 'cha' },
  { k: 'investigation', th: 'สืบสวน', en: 'Investigation', ab: 'int' },
  { k: 'medicine', th: 'แพทย์', en: 'Medicine', ab: 'wis' },
  { k: 'nature', th: 'ธรรมชาติ', en: 'Nature', ab: 'int' },
  { k: 'perception', th: 'การรับรู้', en: 'Perception', ab: 'wis' },
  { k: 'performance', th: 'การแสดง', en: 'Performance', ab: 'cha' },
  { k: 'persuasion', th: 'โน้มน้าว', en: 'Persuasion', ab: 'cha' },
  { k: 'religion', th: 'ศาสนา', en: 'Religion', ab: 'int' },
  { k: 'sleight', th: 'มือไว', en: 'Sleight of Hand', ab: 'dex' },
  { k: 'stealth', th: 'ซ่อนเร้น', en: 'Stealth', ab: 'dex' },
  { k: 'survival', th: 'เอาตัวรอด', en: 'Survival', ab: 'wis' },
];

const mod = s => Math.floor((s - 10) / 2);
const profBonus = lvl => Math.ceil(lvl / 4) + 1;

function maxHp(c) {
  if (c.hpMaxOverride != null) return c.hpMaxOverride;
  const hd = CLASSES[c.cls].hd;
  const cm = mod(c.scores.con);
  return Math.max(1, hd + cm + (c.level - 1) * Math.max(1, Math.floor(hd / 2) + 1 + cm));
}
const autoAc = c => 10 + mod(c.scores.dex);
const skillBonus = (c, s) => mod(c.scores[s.ab]) + profBonus(c.level) * (c.skills[s.k] || 0);

/* =====================================================================
   ตัวละคร (เก็บใน localStorage)
   ===================================================================== */
const blankChar = () => ({
  id: uid8(), name: '', race: '', cls: 'Fighter', level: 1, background: '',
  scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saves: { str: true, con: true }, skills: {},
  acOverride: null, speed: 30, hpMaxOverride: null, hp: null,
  attacks: [], notes: '',
});

function normChar(o, keepId) {
  const b = blankChar();
  const c = { ...b, ...o, id: keepId && o.id ? o.id : uid8() };
  c.scores = { ...b.scores, ...(o.scores || {}) };
  ABILITIES.forEach(a => { c.scores[a.k] = clamp(Math.round(Number(c.scores[a.k]) || 10), 1, 30); });
  if (!CLASSES[c.cls]) c.cls = 'Fighter';
  c.level = clamp(Math.round(Number(c.level)) || 1, 1, 20);
  c.saves = o.saves && typeof o.saves === 'object' ? o.saves : b.saves;
  c.skills = o.skills && typeof o.skills === 'object' ? o.skills : {};
  c.attacks = Array.isArray(o.attacks)
    ? o.attacks.slice(0, 30).map(a => ({ id: uid8(), name: String(a.name || ''), bonus: Number(a.bonus) || 0, dmg: String(a.dmg || '') }))
    : [];
  return c;
}

let chars = store.get('chars', []).map(c => normChar(c, true));
if (!chars.length) chars = [blankChar()];
let activeId = store.get('active', chars[0].id);
if (!chars.find(c => c.id === activeId)) activeId = chars[0].id;
const cur = () => chars.find(c => c.id === activeId);
const charLabel = c => `${c.name || 'ไม่มีชื่อ'} (${CLASSES[c.cls].th} ${c.level})`;

/* =====================================================================
   ห้อง / Firebase
   ===================================================================== */
const configured = !/PASTE|YOUR-/.test(`${firebaseConfig.apiKey}${firebaseConfig.databaseURL}`);
const room = { code: null, uid: null, isDM: false, name: store.get('name', ''), unsubs: [] };
let fb = null; // { D, db, uid }
let party = {};

const online = () => !!room.code;
const iAmDM = () => !online() || room.isDM;
const myId = () => (online() ? room.uid : 'local');

async function initFb() {
  if (fb) return fb;
  const V = '10.12.2';
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const [appM, authM, D] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-database.js`),
  ]);
  const app = appM.initializeApp(firebaseConfig);
  const auth = authM.getAuth(app);
  if (auth.authStateReady) await auth.authStateReady();
  if (!auth.currentUser) await authM.signInAnonymously(auth);
  fb = { D, db: D.getDatabase(app), uid: auth.currentUser.uid };
  return fb;
}

const roomRef = sub => fb.D.ref(fb.db, `rooms/${room.code}/${sub}`);

async function enterRoom(code, create) {
  await initFb();
  const { D, db, uid } = fb;
  const snap = await D.get(D.ref(db, `rooms/${code}/meta`));
  if (create) {
    if (snap.exists()) throw new Error('รหัสนี้ถูกใช้แล้ว ลองอีกครั้ง');
    await D.set(D.ref(db, `rooms/${code}/meta`), { dm: uid, created: Date.now() });
  } else if (!snap.exists()) {
    throw new Error('ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง');
  }

  leaveRoom(true);
  room.code = code;
  room.uid = uid;
  tokens = {};
  selected = null;
  $('#logList').innerHTML = '';

  const u = room.unsubs;
  u.push(D.onValue(roomRef('meta'), s => {
    const m = s.val() || {};
    room.isDM = m.dm === uid;
    bgUrl = typeof m.bg === 'string' ? m.bg : '';
    loadBg();
    updateRoomUI();
  }));

  const tref = roomRef('tokens');
  const put = s => { tokens[s.key] = normToken(s.val(), s.key); renderTokenList(); updateSelBar(); draw(); };
  u.push(D.onChildAdded(tref, put));
  u.push(D.onChildChanged(tref, put));
  u.push(D.onChildRemoved(tref, s => {
    delete tokens[s.key];
    if (selected === s.key) selected = null;
    renderTokenList(); updateSelBar(); draw();
  }));

  u.push(D.onChildAdded(D.query(roomRef('rolls'), D.limitToLast(40)), s => {
    const r = s.val();
    if (!r || typeof r.total !== 'number') return;
    addLog(r);
    if (Date.now() - (r.ts || 0) < 6000) showResult(r);
  }));

  u.push(D.onValue(roomRef('chars'), s => { party = s.val() || {}; renderParty(); }));

  u.push(D.onValue(D.ref(db, '.info/connected'), s => {
    if (!s.val() || !room.code) return;
    const mine = roomRef(`chars/${uid}`);
    D.onDisconnect(mine).remove();
    syncMyChar();
  }));

  store.set('room', code);
  updateRoomUI();
}

function leaveRoom(silent) {
  if (fb && room.code && !silent) {
    fb.D.remove(roomRef(`chars/${room.uid}`)).catch(() => {});
  }
  room.unsubs.forEach(f => { try { f(); } catch { /* ignore */ } });
  room.unsubs = [];
  room.code = null;
  room.isDM = false;
  party = {};
  if (!silent) {
    store.set('room', null);
    tokens = store.get('tokens', {});
    selected = null;
    bgUrl = store.get('bg', '');
    loadBg();
    $('#logList').innerHTML = '';
    renderTokenList(); renderParty(); updateSelBar(); updateRoomUI(); draw();
  }
}

function syncMyChar() {
  if (!online() || !fb) return;
  const c = cur();
  const mh = maxHp(c);
  fb.D.set(roomRef(`chars/${room.uid}`), {
    player: room.name || '',
    name: c.name || 'ไม่มีชื่อ',
    cls: c.cls,
    level: c.level,
    hp: c.hp ?? mh,
    maxHp: mh,
    ac: c.acOverride ?? autoAc(c),
  }).catch(() => {});
}

/* =====================================================================
   ลูกเต๋า + ประวัติ
   ===================================================================== */
let rollMode = 'normal';
const MODES = [['dis', 'เสียเปรียบ'], ['normal', 'ปกติ'], ['adv', 'ได้เปรียบ']];

function buildSegs() {
  $$('.mode-seg').forEach(seg => {
    seg.innerHTML = '';
    MODES.forEach(([m, l]) => seg.append(h('button', { type: 'button', 'data-mode': m, text: l, onclick: () => setMode(m) })));
  });
  setMode('normal');
}
function setMode(m) {
  rollMode = m;
  $$('.mode-seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
}

const whoName = () => cur().name || room.name || 'ผู้เล่น';

function emitRoll(label, expr) {
  const res = rollExpr(expr, rollMode);
  if (!res) { toast('สูตรไม่ถูกต้อง ลองเช่น 2d6+3'); return null; }
  const r = {
    who: whoName(), label: label || expr, expr, total: res.total,
    detail: res.detail, nat: res.nat, mode: res.mode, ts: Date.now(),
  };
  if (rollMode !== 'normal' && /d20/i.test(expr)) setMode('normal');
  if (online()) {
    fb.D.push(roomRef('rolls'), r).catch(() => toast('ส่งผลทอยเข้าห้องไม่สำเร็จ'));
  } else {
    addLog(r);
    showResult(r);
  }
  return r;
}

function addLog(r) {
  const list = $('#logList');
  const cls = r.nat === 20 ? ' crit' : r.nat === 1 ? ' fumble' : '';
  const time = new Date(r.ts || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const modeTag = r.mode === 'adv' ? ' (ได้เปรียบ)' : r.mode === 'dis' ? ' (เสียเปรียบ)' : '';
  list.prepend(h('li', { class: 'log-item' + cls },
    h('div', { class: 'log-head' },
      h('b', { text: String(r.who || '?') }),
      h('span', { class: 'muted', text: String(r.label || r.expr || '') + modeTag }),
      h('span', { class: 'log-time', text: time })),
    h('div', { class: 'log-body' },
      h('span', { class: 'log-total', text: String(r.total) }),
      h('span', { class: 'muted small', text: String(r.detail || '') }))));
  while (list.children.length > 60) list.lastChild.remove();
}

let currentTab = 'sheet';
function showResult(r) {
  $('#bigWho').textContent = `${r.who} · ${r.label || r.expr}`;
  $('#bigTotal').textContent = r.total;
  $('#bigDetail').textContent = r.detail || '';
  const card = $('#bigCard');
  card.classList.toggle('crit', r.nat === 20);
  card.classList.toggle('fumble', r.nat === 1);
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
  if (currentTab !== 'dice') {
    const tag = r.nat === 20 ? ' 🎯 คริติคอล!' : r.nat === 1 ? ' 💀 พลาดหนัก' : '';
    toast(`${r.who} · ${r.label || r.expr}: ${r.total}${tag}`, 4500);
  }
}

/* --- หน้าลูกเต๋า --- */
let dCount = 1;
let dMod = 0;
function buildDice() {
  const grid = $('#dieGrid');
  [4, 6, 8, 10, 12, 20, 100].forEach(n => {
    grid.append(h('button', { class: 'die d' + n, 'aria-label': 'ทอย d' + n, onclick: () => rollDice(n) }, h('span', { text: 'd' + n })));
  });
  $$('[data-step]').forEach(b => b.addEventListener('click', () => {
    const d = Number(b.dataset.d);
    if (b.dataset.step === 'count') dCount = clamp(dCount + d, 1, 20);
    else dMod = clamp(dMod + d, -30, 30);
    $('#cntVal').textContent = dCount;
    $('#modVal').textContent = fmt(dMod);
  }));
  $('#exprForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#exprIn').value.trim();
    if (v) emitRoll(v, v);
  });
}
function rollDice(n) {
  const expr = `${dCount}d${n}${dMod ? (dMod > 0 ? '+' : '-') + Math.abs(dMod) : ''}`;
  emitRoll(expr, expr);
}

/* =====================================================================
   หน้าตัวละคร
   ===================================================================== */
let saveT;
function changed() {
  store.set('chars', chars);
  store.set('active', activeId);
  const opt = $('#charSelect option:checked');
  if (opt) opt.textContent = charLabel(cur());
  refreshDerived();
  clearTimeout(saveT);
  saveT = setTimeout(syncMyChar, 400);
}

function fillSelect() {
  const sel = $('#charSelect');
  sel.innerHTML = '';
  chars.forEach(c => sel.append(h('option', { value: c.id, text: charLabel(c) })));
  sel.value = activeId;
}

function buildSheet() {
  const clsSel = $('#f-cls');
  Object.entries(CLASSES).forEach(([k, v]) => clsSel.append(h('option', { value: k, text: `${v.th} (${k})` })));

  // ค่าสถานะ
  const box = $('#abilities');
  ABILITIES.forEach(a => {
    box.append(h('div', { class: 'ab' },
      h('div', { class: 'ab-name', text: `${a.th} ${a.en}` }),
      h('input', {
        type: 'number', min: 1, max: 30, class: 'ab-score', 'data-ab': a.k, inputmode: 'numeric',
        oninput: e => {
          const v = Number(e.target.value);
          if (!Number.isFinite(v) || e.target.value === '') return;
          cur().scores[a.k] = clamp(Math.round(v), 1, 30);
          changed();
        },
      }),
      h('button', { class: 'ab-mod', id: 'mod-' + a.k, title: 'ทอยเช็ค', onclick: () => emitRoll(`เช็ค ${a.en}`, bonusExpr(mod(cur().scores[a.k]))) }),
      h('div', { class: 'ab-save' },
        h('input', { type: 'checkbox', 'data-save': a.k, title: 'ชำนาญ Saving Throw', onchange: e => { cur().saves[a.k] = e.target.checked; changed(); } }),
        h('button', {
          id: 'save-' + a.k, title: 'ทอย Saving Throw',
          onclick: () => { const c = cur(); emitRoll(`เซฟ ${a.en}`, bonusExpr(mod(c.scores[a.k]) + (c.saves[a.k] ? profBonus(c.level) : 0))); },
        }))));
  });

  // ทักษะ
  const list = $('#skills');
  SKILLS.forEach(s => {
    list.append(h('div', { class: 'sk', id: 'sk-' + s.k },
      h('button', {
        class: 'sk-state', title: 'สลับ: ไม่ถนัด / ชำนาญ / เชี่ยวชาญ',
        onclick: () => { const c = cur(); c.skills[s.k] = ((c.skills[s.k] || 0) + 1) % 3; changed(); },
      }),
      h('span', { class: 'sk-name' }, s.th, h('small', { text: ` ${s.en} · ${s.ab.toUpperCase()}` })),
      h('button', { class: 'sk-bonus', onclick: () => emitRoll(s.th, bonusExpr(skillBonus(cur(), s))) })));
  });

  // ฟิลด์ทั่วไป
  $$('[data-f]').forEach(el => el.addEventListener('input', () => {
    const c = cur();
    const k = el.dataset.f;
    let v = el.value;
    if (el.dataset.t === 'num') v = v === '' ? null : Number(v);
    if (k === 'level') v = clamp(Math.round(v || 1), 1, 20);
    if (k === 'speed' && v == null) v = 30;
    c[k] = v;
    changed();
  }));
  clsSel.addEventListener('change', () => {
    const c = cur();
    c.saves = Object.fromEntries(CLASSES[c.cls].saves.map(k => [k, true]));
    ABILITIES.forEach(a => { $(`[data-save="${a.k}"]`).checked = !!c.saves[a.k]; });
    changed();
  });

  // เครื่องมือ
  $('#charSelect').addEventListener('change', e => { activeId = e.target.value; store.set('active', activeId); renderSheet(); syncMyChar(); });
  $('#charNew').onclick = () => { const c = blankChar(); chars.push(c); activeId = c.id; fillSelect(); renderSheet(); changed(); };
  $('#charDup').onclick = () => { const c = normChar(JSON.parse(JSON.stringify(cur()))); c.name = (c.name || 'ตัวละคร') + ' (สำเนา)'; chars.push(c); activeId = c.id; fillSelect(); renderSheet(); changed(); };
  $('#charDel').onclick = () => {
    if (!confirm(`ลบ "${cur().name || 'ไม่มีชื่อ'}" ?`)) return;
    chars = chars.filter(c => c.id !== activeId);
    if (!chars.length) chars = [blankChar()];
    activeId = chars[0].id;
    fillSelect(); renderSheet(); changed();
  };
  $('#charExport').onclick = () => {
    const blob = new Blob([JSON.stringify(cur(), null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `${(cur().name || 'character').replace(/[^\w\u0E00-\u0E7F-]+/g, '_')}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#charImport').onclick = () => $('#importFile').click();
  $('#importFile').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const added = [].concat(data).filter(o => o && typeof o === 'object').map(o => normChar(o));
      if (!added.length) throw new Error('empty');
      chars.push(...added);
      activeId = added[added.length - 1].id;
      fillSelect(); renderSheet(); changed();
      toast(`นำเข้า ${added.length} ตัวละครแล้ว`);
    } catch { toast('ไฟล์ไม่ถูกต้อง'); }
  };

  // สุ่ม/จัดสถานะ
  const assign = vals => {
    const c = cur();
    const sorted = [...vals].sort((a, b) => b - a);
    CLASSES[c.cls].pri.forEach((k, i) => { c.scores[k] = sorted[i]; });
    renderSheet(); changed();
  };
  $('#abRoll').onclick = () => {
    const roll = () => { const r = [rnd(6), rnd(6), rnd(6), rnd(6)].sort((a, b) => a - b); return r[1] + r[2] + r[3]; };
    const vals = Array.from({ length: 6 }, roll);
    assign(vals);
    toast(`สุ่มได้ ${[...vals].sort((a, b) => b - a).join(', ')} (จัดตามอาชีพให้แล้ว แก้ได้)`, 5000);
  };
  $('#abStd').onclick = () => assign([15, 14, 13, 12, 10, 8]);
  $('#abReset').onclick = () => { ABILITIES.forEach(a => { cur().scores[a.k] = 10; }); renderSheet(); changed(); };

  // Initiative / HP
  $('#init').onclick = () => emitRoll('Initiative', bonusExpr(mod(cur().scores.dex)));
  $$('[data-hp]').forEach(b => b.addEventListener('click', () => {
    const c = cur();
    const mh = maxHp(c);
    c.hp = clamp((c.hp ?? mh) + Number(b.dataset.hp), 0, mh + 999);
    $('#f-hp').value = c.hp;
    changed();
  }));
  $('#hpFull').onclick = () => { cur().hp = null; $('#f-hp').value = maxHp(cur()); changed(); };

  // อาวุธ
  $('#atkAdd').onclick = () => {
    const c = cur();
    const m = mod(c.scores.str);
    c.attacks.push({ id: uid8(), name: '', bonus: m + profBonus(c.level), dmg: `1d8${m >= 0 ? '+' : '-'}${Math.abs(m)}` });
    renderAttacks(); changed();
  };
}

function renderAttacks() {
  const box = $('#attacks');
  box.innerHTML = '';
  const c = cur();
  c.attacks.forEach(a => {
    box.append(h('div', { class: 'atk' },
      h('input', { placeholder: 'ชื่ออาวุธ/สกิล', value: a.name, oninput: e => { a.name = e.target.value; changed(); } }),
      h('input', { type: 'number', class: 'sm', title: 'โบนัสโจมตี', value: a.bonus, inputmode: 'numeric', oninput: e => { a.bonus = Number(e.target.value) || 0; changed(); } }),
      h('input', { class: 'sm', placeholder: 'ดาเมจ เช่น 1d8+3', value: a.dmg, oninput: e => { a.dmg = e.target.value; changed(); } }),
      h('div', { class: 'atk-btns' },
        h('button', { text: '⚔ โจมตี', onclick: () => emitRoll(`${a.name || 'โจมตี'} (โจมตี)`, bonusExpr(a.bonus)) }),
        h('button', { text: '💥 ดาเมจ', onclick: () => emitRoll(`${a.name || 'ดาเมจ'} (ดาเมจ)`, a.dmg || '1d4') }),
        h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => { c.attacks = c.attacks.filter(x => x !== a); renderAttacks(); changed(); } }))));
  });
}

function renderSheet() {
  const c = cur();
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f;
    el.value = k === 'hp' ? (c.hp ?? maxHp(c)) : (c[k] ?? '');
  });
  ABILITIES.forEach(a => {
    $(`[data-ab="${a.k}"]`).value = c.scores[a.k];
    $(`[data-save="${a.k}"]`).checked = !!c.saves[a.k];
  });
  $('#charSelect').value = activeId;
  renderAttacks();
  refreshDerived();
}

function refreshDerived() {
  const c = cur();
  const pb = profBonus(c.level);
  $('#pb').textContent = fmt(pb);
  ABILITIES.forEach(a => {
    const m = mod(c.scores[a.k]);
    $('#mod-' + a.k).textContent = fmt(m);
    $('#save-' + a.k).textContent = `เซฟ ${fmt(m + (c.saves[a.k] ? pb : 0))}`;
  });
  SKILLS.forEach(s => {
    const row = $('#sk-' + s.k);
    $('.sk-bonus', row).textContent = fmt(skillBonus(c, s));
    $('.sk-state', row).textContent = ['○', '●', '◆'][c.skills[s.k] || 0];
  });
  $('#init').textContent = fmt(mod(c.scores.dex));
  $('#passive').textContent = 10 + skillBonus(c, SKILLS.find(s => s.k === 'perception'));

  const mh = maxHp(c);
  $('#f-ac').placeholder = autoAc(c);
  $('#f-hpmax').placeholder = mh;
  if (c.hp == null && document.activeElement !== $('#f-hp')) $('#f-hp').value = mh;
  const pct = clamp(((c.hp ?? mh) / mh) * 100, 0, 100);
  const fill = $('#hpfill');
  fill.style.width = pct + '%';
  fill.className = pct <= 25 ? 'low' : pct <= 60 ? 'mid' : '';
}

/* =====================================================================
   กระดาน
   ===================================================================== */
const CELL = 48;
const GRID = 40;
const COLORS = ['#e5534b', '#e0b457', '#6cc070', '#4ea1ff', '#a371f7', '#f0883e', '#39c5cf', '#d2d6dc'];
const colorFor = id => COLORS[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length];

let tokens = store.get('tokens', {});
let selected = null;
let bgUrl = store.get('bg', '');
let bgImg = null;
const view = { s: 1, x: 0, y: 0 };
let W = 0;
let H = 0;
let dpr = 1;
let fitted = false;
let drag = null;
let pan = null;
let pinch = null;
const ptrs = new Map();

const cv = $('#board');
const ctx = cv.getContext('2d');

function normToken(t, id) {
  const size = clamp(Math.round(Number(t?.size)) || 1, 1, 4);
  return {
    id,
    name: String(t?.name ?? '').slice(0, 40),
    size,
    color: safeColor(t?.color),
    owner: String(t?.owner ?? ''),
    x: clamp(Math.round(Number(t?.x)) || 0, 0, GRID - size),
    y: clamp(Math.round(Number(t?.y)) || 0, 0, GRID - size),
  };
}
const canEdit = t => iAmDM() || t.owner === myId();

function resize() {
  const r = cv.parentElement.getBoundingClientRect();
  if (!r.width || !r.height) return;
  dpr = window.devicePixelRatio || 1;
  W = r.width;
  H = r.height;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  draw();
}
new ResizeObserver(() => { if (currentTab === 'board') resize(); }).observe($('.board-wrap'));

function fitView() {
  if (!W) return;
  view.s = clamp(Math.min(W, H) / (GRID * CELL), 0.2, 4);
  view.x = (W - GRID * CELL * view.s) / 2;
  view.y = (H - GRID * CELL * view.s) / 2;
}
function zoomAt(px, py, f) {
  const ns = clamp(view.s * f, 0.2, 4);
  const k = ns / view.s;
  view.x = px - (px - view.x) * k;
  view.y = py - (py - view.y) * k;
  view.s = ns;
}
const toWorld = (px, py) => ({ x: (px - view.x) / view.s, y: (py - view.y) / view.s });

function sortedTokens(smallFirst) {
  return Object.values(tokens).sort((a, b) => (smallFirst ? a.size - b.size : b.size - a.size));
}
function hitToken(px, py) {
  const w = toWorld(px, py);
  const cx = w.x / CELL;
  const cy = w.y / CELL;
  return sortedTokens(true).find(t => cx >= t.x && cx < t.x + t.size && cy >= t.y && cy < t.y + t.size) || null;
}

function draw() {
  if (!W) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d1016';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.x, dpr * view.y);

  const size = GRID * CELL;
  ctx.fillStyle = '#1b2230';
  ctx.fillRect(0, 0, size, size);
  if (bgImg && bgImg.naturalWidth) ctx.drawImage(bgImg, 0, 0, size, size);

  // เส้นกริด (วาดเฉพาะส่วนที่มองเห็น)
  const x0 = clamp(Math.floor(-view.x / view.s / CELL), 0, GRID);
  const x1 = clamp(Math.ceil((W - view.x) / view.s / CELL), 0, GRID);
  const y0 = clamp(Math.floor(-view.y / view.s / CELL), 0, GRID);
  const y1 = clamp(Math.ceil((H - view.y) / view.s / CELL), 0, GRID);
  ctx.lineWidth = 1 / view.s;
  for (let i = x0; i <= x1; i++) {
    ctx.strokeStyle = i % 5 === 0 ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, size); ctx.stroke();
  }
  for (let j = y0; j <= y1; j++) {
    ctx.strokeStyle = j % 5 === 0 ? 'rgba(255,255,255,.30)' : 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(0, j * CELL); ctx.lineTo(size, j * CELL); ctx.stroke();
  }

  // เลขพิกัด
  if (view.s > 0.55) {
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = `${11 / view.s}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = x0; i < x1; i++) ctx.fillText(i + 1, i * CELL + 3 / view.s, 2 / view.s);
    for (let j = Math.max(y0, 1); j < y1; j++) ctx.fillText(j + 1, 3 / view.s, j * CELL + 2 / view.s);
  }

  // โทเคน (ใหญ่ก่อน เล็กอยู่บน)
  sortedTokens(false).forEach(t => {
    const cx = (t.x + t.size / 2) * CELL;
    const cy = (t.y + t.size / 2) * CELL;
    const r = (t.size * CELL) / 2 - 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = safeColor(t.color);
    ctx.fill();
    ctx.lineWidth = (t.id === selected ? 4 : 2) / view.s;
    ctx.strokeStyle = t.id === selected ? '#ffd86b' : 'rgba(255,255,255,.75)';
    ctx.stroke();

    ctx.fillStyle = '#10131a';
    ctx.font = `700 ${r * 0.95}px Sarabun, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(([...t.name][0] || '?').toUpperCase(), cx, cy + r * 0.05);

    if (view.s >= 0.5) {
      ctx.font = `600 ${12 / view.s}px Sarabun, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3 / view.s;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(t.name, cx, (t.y + t.size) * CELL + 1 / view.s);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.name, cx, (t.y + t.size) * CELL + 1 / view.s);
    }
  });

  // ระยะที่ลากอยู่
  if (drag && drag.moved && tokens[drag.id]) {
    const t = tokens[drag.id];
    const ft = Math.max(Math.abs(t.x - drag.sx), Math.abs(t.y - drag.sy)) * 5;
    const label = `${ft} ft`;
    const fs = 13 / view.s;
    ctx.font = `700 ${fs}px Sarabun, sans-serif`;
    const tw = ctx.measureText(label).width;
    const lx = (t.x + t.size / 2) * CELL;
    const ly = t.y * CELL - 6 / view.s;
    ctx.fillStyle = 'rgba(0,0,0,.8)';
    ctx.fillRect(lx - tw / 2 - 5 / view.s, ly - fs - 4 / view.s, tw + 10 / view.s, fs + 8 / view.s);
    ctx.fillStyle = '#ffd86b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, lx, ly);
  }

  $('#zoomLbl').textContent = Math.round(view.s * 100) + '%';
}

function loadBg() {
  if (!bgUrl) { bgImg = null; draw(); return; }
  const img = new Image();
  img.onload = () => { bgImg = img; draw(); };
  img.onerror = () => { bgImg = null; toast('โหลดรูปพื้นหลังไม่ได้'); draw(); };
  img.src = bgUrl;
}

/* --- การโต้ตอบ (เมาส์ + ทัช ผ่าน Pointer Events) --- */
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (ptrs.size === 2) {
    drag = null; pan = null;
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    return;
  }
  if (ptrs.size > 2) return;

  const hit = hitToken(e.offsetX, e.offsetY);
  if (hit) {
    selectToken(hit.id);
    if (canEdit(hit)) {
      const w = toWorld(e.offsetX, e.offsetY);
      drag = { id: hit.id, gx: w.x / CELL - hit.x, gy: w.y / CELL - hit.y, sx: hit.x, sy: hit.y, moved: false };
    } else {
      pan = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y };
    }
  } else {
    selectToken(null);
    pan = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y };
  }
});

cv.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });

  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    view.x += cx - pinch.cx;
    view.y += cy - pinch.cy;
    zoomAt(cx, cy, d / pinch.d);
    pinch = { d, cx, cy };
    draw();
    return;
  }
  if (drag) {
    const t = tokens[drag.id];
    if (!t) return;
    const w = toWorld(e.offsetX, e.offsetY);
    const nx = clamp(Math.round(w.x / CELL - drag.gx), 0, GRID - t.size);
    const ny = clamp(Math.round(w.y / CELL - drag.gy), 0, GRID - t.size);
    if (nx !== t.x || ny !== t.y) { t.x = nx; t.y = ny; drag.moved = true; draw(); }
  } else if (pan) {
    view.x = pan.vx + (e.offsetX - pan.x);
    view.y = pan.vy + (e.offsetY - pan.y);
    draw();
  }
});

function endPointer(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) {
    if (drag) {
      const d = drag;
      drag = null;
      if (d.moved && tokens[d.id]) commitMove(d);
      else draw();
    }
    pan = null;
  }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  draw();
}, { passive: false });
cv.addEventListener('dblclick', e => {
  const t = hitToken(e.offsetX, e.offsetY);
  if (t && canEdit(t)) openTokenDialog(t);
});

/* --- จัดการโทเคน --- */
function saveLocalTokens() { if (!online()) store.set('tokens', tokens); }

async function commitMove(d) {
  const t = tokens[d.id];
  if (!online()) { saveLocalTokens(); draw(); return; }
  try {
    await fb.D.update(roomRef(`tokens/${t.id}`), { x: t.x, y: t.y });
  } catch {
    t.x = d.sx; t.y = d.sy; draw();
    toast('ย้ายไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)');
  }
}

async function tokenPut(t) {
  if (online()) {
    try {
      await fb.D.set(roomRef(`tokens/${t.id}`), { name: t.name, x: t.x, y: t.y, size: t.size, color: t.color, owner: t.owner });
    } catch { toast('บันทึกโทเคนไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)'); }
  } else {
    tokens[t.id] = t;
    saveLocalTokens();
    renderTokenList(); updateSelBar(); draw();
  }
}

async function tokenDelete(id) {
  if (online()) {
    try { await fb.D.remove(roomRef(`tokens/${id}`)); } catch { toast('ลบไม่สำเร็จ (ไม่มีสิทธิ์)'); }
  } else {
    delete tokens[id];
    if (selected === id) selected = null;
    saveLocalTokens();
    renderTokenList(); updateSelBar(); draw();
  }
}

function selectToken(id) {
  selected = id;
  updateSelBar();
  renderTokenList();
  draw();
}

function updateSelBar() {
  const t = tokens[selected];
  $('#selBar').hidden = !t;
  if (!t) return;
  $('#selName').textContent = t.name || '(ไม่มีชื่อ)';
  $('#selEdit').disabled = !canEdit(t);
  $('#selDel').disabled = !canEdit(t);
}

function centerOn(t) {
  if (!W) return;
  view.x = W / 2 - (t.x + t.size / 2) * CELL * view.s;
  view.y = H / 2 - (t.y + t.size / 2) * CELL * view.s;
  draw();
}

function freeSpot(size) {
  const c = toWorld(W / 2, H / 2);
  const bx = clamp(Math.floor(c.x / CELL - size / 2), 0, GRID - size);
  const by = clamp(Math.floor(c.y / CELL - size / 2), 0, GRID - size);
  const list = Object.values(tokens);
  const free = (x, y) => x >= 0 && y >= 0 && x + size <= GRID && y + size <= GRID
    && !list.some(t => x < t.x + t.size && x + size > t.x && y < t.y + t.size && y + size > t.y);
  for (let r = 0; r <= 8; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && free(bx + dx, by + dy)) return { x: bx + dx, y: by + dy };
      }
    }
  }
  return { x: bx, y: by };
}

function renderTokenList() {
  const box = $('#tokList');
  box.innerHTML = '';
  const arr = Object.values(tokens).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  if (!arr.length) { box.append(h('div', { class: 'muted small', text: 'ยังไม่มีโทเคน — กด "+ โทเคน" หรือ "ตัวฉัน"' })); return; }
  arr.forEach(t => {
    box.append(h('button', { class: 'tok-row' + (t.id === selected ? ' sel' : ''), onclick: () => { selectToken(t.id); centerOn(t); } },
      h('i', { class: 'dot', style: `background:${safeColor(t.color)}` }),
      h('span', { text: t.name || '(ไม่มีชื่อ)' }),
      h('small', { class: 'muted', text: `${t.x + 1},${t.y + 1}` })));
  });
}

function renderParty() {
  const box = $('#partyList');
  box.innerHTML = '';
  $('#partyBox').hidden = !online();
  Object.values(party).forEach(p => {
    box.append(h('div', { class: 'party-row' },
      h('b', { text: String(p.name || '?') }),
      h('span', { class: 'muted small', text: `${p.player || ''} · ${CLASSES[p.cls]?.th ?? p.cls} ${p.level}` }),
      h('span', { class: 'pill', text: `HP ${p.hp}/${p.maxHp}` }),
      h('span', { class: 'pill', text: `AC ${p.ac}` })));
  });
}

/* --- กล่องแก้ไขโทเคน --- */
let tokEditing = null;
let tokColor = COLORS[0];

function buildSwatches() {
  const box = $('#swatches');
  box.innerHTML = '';
  COLORS.forEach(c => box.append(h('button', {
    type: 'button', class: 'sw' + (c === tokColor ? ' on' : ''), style: `background:${c}`, 'aria-label': c,
    onclick: () => { tokColor = c; buildSwatches(); },
  })));
}
function openTokenDialog(t) {
  tokEditing = t || null;
  $('#tok-title').textContent = t ? 'แก้ไขโทเคน' : 'โทเคนใหม่';
  $('#tok-name').value = t?.name || '';
  $('#tok-size').value = t?.size || 1;
  tokColor = t?.color || colorFor(myId());
  buildSwatches();
  $('#tok-del').hidden = !t;
  $('#tokDialog').showModal();
  $('#tok-name').focus();
}

/* =====================================================================
   UI ของห้อง
   ===================================================================== */
function updateRoomUI() {
  const b = $('#roomBtn');
  b.classList.toggle('on', online());
  b.textContent = online() ? `ห้อง ${room.code} · ${room.isDM ? 'DM' : 'ผู้เล่น'}` : 'ออฟไลน์';
  $('#dmBox').hidden = !iAmDM();
  $('#r-leave').hidden = !online();
  $('#r-copy').hidden = !online();
  $('#r-create').disabled = !configured;
  $('#r-join').disabled = !configured;
  $('#r-status').textContent = !configured
    ? 'ยังไม่ได้ตั้งค่า Firebase (firebase-config.js) — ใช้งานแบบออฟไลน์ได้ตามปกติ'
    : online()
      ? `อยู่ในห้อง ${room.code} · คุณเป็น ${room.isDM ? 'DM' : 'ผู้เล่น'}`
      : 'ออฟไลน์ — สร้างห้องหรือใส่รหัสเพื่อเล่นกับเพื่อน';
  updateSelBar();
  renderParty();
}

function openRoomDialog(msg = '') {
  $('#r-name').value = room.name;
  if (online()) $('#r-code').value = room.code;
  $('#r-err').textContent = msg;
  updateRoomUI();
  $('#roomDialog').showModal();
}

function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => A[rnd(A.length) - 1]).join('');
}

function needName() {
  const n = $('#r-name').value.trim();
  if (!n) { $('#r-err').textContent = 'ใส่ชื่อที่แสดงก่อน'; return null; }
  room.name = n;
  store.set('name', n);
  return n;
}

function bindRoomUI() {
  $('#roomBtn').onclick = () => openRoomDialog();
  $('#r-close').onclick = () => $('#roomDialog').close();
  $('#r-create').onclick = async () => {
    if (!needName()) return;
    $('#r-err').textContent = 'กำลังสร้างห้อง...';
    try {
      let lastErr;
      for (let i = 0; i < 5; i++) {
        try { await enterRoom(genCode(), true); lastErr = null; break; } catch (e) { lastErr = e; if (!/ถูกใช้แล้ว/.test(e.message)) break; }
      }
      if (lastErr) throw lastErr;
      $('#r-code').value = room.code;
      $('#r-err').textContent = '';
      toast(`สร้างห้อง ${room.code} แล้ว กด "คัดลอกลิงก์ห้อง" ส่งให้เพื่อนได้เลย`, 5000);
      $('#roomDialog').close();
    } catch (e) { $('#r-err').textContent = e.message || 'สร้างห้องไม่สำเร็จ'; }
  };
  $('#r-join').onclick = async () => {
    if (!needName()) return;
    const code = $('#r-code').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) { $('#r-err').textContent = 'รหัสห้องไม่ถูกต้อง'; return; }
    $('#r-err').textContent = 'กำลังเข้าห้อง...';
    try {
      await enterRoom(code, false);
      $('#r-err').textContent = '';
      $('#roomDialog').close();
    } catch (e) { $('#r-err').textContent = e.message || 'เข้าห้องไม่สำเร็จ'; }
  };
  $('#r-leave').onclick = () => { leaveRoom(false); $('#roomDialog').close(); };
  $('#r-copy').onclick = async () => {
    const url = `${location.origin}${location.pathname}?room=${room.code}`;
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch { prompt('คัดลอกลิงก์นี้', url); }
  };
}

/* =====================================================================
   เริ่มต้น
   ===================================================================== */
function showTab(name) {
  currentTab = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'board') {
    resize();
    if (!fitted && W) { fitView(); fitted = true; }
    draw();
  }
}

function bindBoardUI() {
  $('#tokAdd').onclick = () => openTokenDialog(null);
  $('#tokMine').onclick = () => {
    const c = cur();
    const name = c.name || 'ตัวฉัน';
    const mine = Object.values(tokens).find(t => t.owner === myId() && t.name === name);
    if (mine) { selectToken(mine.id); centerOn(mine); return; }
    const pos = freeSpot(1);
    tokenPut({ id: uid8(), name, size: 1, color: colorFor(myId()), x: pos.x, y: pos.y, owner: myId() });
  };
  $('#zoomIn').onclick = () => { zoomAt(W / 2, H / 2, 1.25); draw(); };
  $('#zoomOut').onclick = () => { zoomAt(W / 2, H / 2, 1 / 1.25); draw(); };
  $('#zoomFit').onclick = () => { fitView(); draw(); };
  $('#selEdit').onclick = () => { const t = tokens[selected]; if (t) openTokenDialog(t); };
  $('#selDel').onclick = () => { const t = tokens[selected]; if (t && confirm(`ลบโทเคน "${t.name}" ?`)) tokenDelete(t.id); };

  $('#tok-cancel').onclick = () => $('#tokDialog').close();
  $('#tok-del').onclick = async () => {
    if (tokEditing) await tokenDelete(tokEditing.id);
    $('#tokDialog').close();
  };
  $('#tok-save').onclick = async () => {
    const name = $('#tok-name').value.trim().slice(0, 40) || 'โทเคน';
    const size = Number($('#tok-size').value);
    if (tokEditing && tokens[tokEditing.id]) {
      const t = { ...tokens[tokEditing.id], name, size, color: tokColor };
      t.x = clamp(t.x, 0, GRID - size);
      t.y = clamp(t.y, 0, GRID - size);
      await tokenPut(t);
    } else {
      const pos = freeSpot(size);
      await tokenPut({ id: uid8(), name, size, color: tokColor, x: pos.x, y: pos.y, owner: myId() });
    }
    $('#tokDialog').close();
  };

  $('#bgSet').onclick = async () => {
    const url = $('#bgUrl').value.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast('URL ต้องขึ้นต้นด้วย http(s)://'); return; }
    await setBg(url);
  };
  $('#bgClear').onclick = () => { $('#bgUrl').value = ''; setBg(''); };
  $('#tokClear').onclick = async () => {
    if (!confirm('ล้างโทเคนทั้งหมดบนกระดาน?')) return;
    if (online()) { try { await fb.D.remove(roomRef('tokens')); } catch { toast('ไม่มีสิทธิ์'); } }
    else { tokens = {}; selected = null; saveLocalTokens(); renderTokenList(); updateSelBar(); draw(); }
  };
}

async function setBg(url) {
  if (online()) {
    try { await fb.D.update(roomRef('meta'), { bg: url }); } catch { toast('ตั้งพื้นหลังไม่สำเร็จ (เฉพาะ DM)'); }
  } else {
    bgUrl = url;
    store.set('bg', url);
    loadBg();
  }
}

async function boot() {
  buildSheet();
  buildSegs();
  buildDice();
  bindBoardUI();
  bindRoomUI();
  fillSelect();
  renderSheet();
  renderTokenList();
  updateRoomUI();
  loadBg();
  $('#bgUrl').value = bgUrl;

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) showTab(b.dataset.tab);
  });
  window.addEventListener('resize', () => { if (currentTab === 'board') resize(); });

  // เข้าห้องอัตโนมัติ: จากลิงก์ ?room=CODE หรือห้องล่าสุด
  const qp = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  const code = qp || store.get('room', '') || '';
  if (qp) $('#r-code').value = qp;
  if (!configured) return;
  if (code && room.name) {
    try { await enterRoom(code, false); } catch (e) { if (qp) openRoomDialog(e.message); }
  } else if (qp) {
    openRoomDialog();
  }
}

boot();
