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
    try { localStorage.setItem('dndtable.' + k, JSON.stringify(v)); return true; } catch { return false; }
  },
};
store.del = k => { try { localStorage.removeItem('dndtable.' + k); } catch { /* ignore */ } };
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

// ผู้ร่ายเวท: t = full/half/pact, ab = ค่าสถานะร่ายเวท, prep = สูตรเวทที่เตรียมได้
const CASTER = {
  Bard: { t: 'full', ab: 'cha' }, Cleric: { t: 'full', ab: 'wis', prep: 'full' }, Druid: { t: 'full', ab: 'wis', prep: 'full' },
  Sorcerer: { t: 'full', ab: 'cha' }, Wizard: { t: 'full', ab: 'int', prep: 'full' },
  Paladin: { t: 'half', ab: 'cha', prep: 'half' }, Ranger: { t: 'half', ab: 'wis' }, Warlock: { t: 'pact', ab: 'cha' },
};
const FULL_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const spellAb = c => c.spellAb || CASTER[c.cls]?.ab || null;
function autoSlots(c) {
  const r = Array(9).fill(0);
  const k = CASTER[c.cls];
  if (!k) return r;
  if (k.t === 'pact') {
    const n = c.level === 1 ? 1 : c.level <= 10 ? 2 : c.level <= 16 ? 3 : 4;
    const lv = c.level <= 2 ? 1 : c.level <= 4 ? 2 : c.level <= 6 ? 3 : c.level <= 8 ? 4 : 5;
    r[lv - 1] = n;
    return r;
  }
  const cl = k.t === 'full' ? c.level : (c.level >= 2 ? Math.ceil(c.level / 2) : 0);
  (FULL_SLOTS[cl] || []).forEach((n, i) => { r[i] = n; });
  return r;
}
const slotMax = (c, l) => (c.slotsMax[l] != null ? c.slotsMax[l] : autoSlots(c)[l - 1]);
function prepMax(c) {
  const k = CASTER[c.cls];
  if (!k?.prep) return null;
  const m = mod(c.scores[spellAb(c) || k.ab]);
  return Math.max(1, m + (k.prep === 'full' ? c.level : Math.floor(c.level / 2)));
}
// กฎ D&D 2024: เผ่า (Species) ไม่ให้โบนัสสถานะ — โบนัสมาจากภูมิหลัง (+2/+1 หรือ +1/+1/+1 ในสามค่าที่ภูมิหลังกำหนด)
const SPECIES = {
  Aasimar: { th: 'อาซิมาร์', speed: 30 }, Dragonborn: { th: 'ดราก้อนบอร์น', speed: 30 }, Dwarf: { th: 'ดวาร์ฟ', speed: 30 },
  Elf: { th: 'เอลฟ์', speed: 30 }, Gnome: { th: 'โนม', speed: 30 }, Goliath: { th: 'โกไลแอธ', speed: 35 },
  Halfling: { th: 'ฮาล์ฟลิ่ง', speed: 30 }, Human: { th: 'มนุษย์', speed: 30 }, Orc: { th: 'ออร์ค', speed: 30 }, Tiefling: { th: 'เทียฟลิง', speed: 30 },
};
const BACKGROUNDS = {
  Acolyte: { th: 'ผู้รับใช้ศาสนา', ab: ['int', 'wis', 'cha'], sk: ['insight', 'religion'], tool: "Calligrapher's Supplies", feat: 'Magic Initiate (Cleric)' },
  Artisan: { th: 'ช่างฝีมือ', ab: ['str', 'dex', 'int'], sk: ['investigation', 'persuasion'], tool: "Artisan's Tools (1 ชนิด)", feat: 'Crafter' },
  Charlatan: { th: 'นักต้มตุ๋น', ab: ['dex', 'con', 'cha'], sk: ['deception', 'sleight'], tool: 'Forgery Kit', feat: 'Skilled' },
  Criminal: { th: 'อาชญากร', ab: ['dex', 'con', 'int'], sk: ['sleight', 'stealth'], tool: "Thieves' Tools", feat: 'Alert' },
  Entertainer: { th: 'นักแสดง', ab: ['str', 'dex', 'cha'], sk: ['acrobatics', 'performance'], tool: 'Musical Instrument (1 ชนิด)', feat: 'Musician' },
  Farmer: { th: 'ชาวนา', ab: ['str', 'con', 'wis'], sk: ['animal', 'nature'], tool: "Carpenter's Tools", feat: 'Tough' },
  Guard: { th: 'ทหารยาม', ab: ['str', 'int', 'wis'], sk: ['athletics', 'perception'], tool: 'Gaming Set (1 ชนิด)', feat: 'Alert' },
  Guide: { th: 'ไกด์', ab: ['dex', 'con', 'wis'], sk: ['stealth', 'survival'], tool: "Cartographer's Tools", feat: 'Magic Initiate (Druid)' },
  Hermit: { th: 'ฤๅษี', ab: ['con', 'wis', 'cha'], sk: ['medicine', 'religion'], tool: 'Herbalism Kit', feat: 'Healer' },
  Merchant: { th: 'พ่อค้า', ab: ['con', 'int', 'cha'], sk: ['animal', 'persuasion'], tool: "Navigator's Tools", feat: 'Lucky' },
  Noble: { th: 'ขุนนาง', ab: ['str', 'int', 'cha'], sk: ['history', 'persuasion'], tool: 'Gaming Set (1 ชนิด)', feat: 'Skilled' },
  Sage: { th: 'นักปราชญ์', ab: ['con', 'int', 'wis'], sk: ['arcana', 'history'], tool: "Calligrapher's Supplies", feat: 'Magic Initiate (Wizard)' },
  Sailor: { th: 'กะลาสี', ab: ['str', 'dex', 'wis'], sk: ['acrobatics', 'perception'], tool: "Navigator's Tools", feat: 'Tavern Brawler' },
  Scribe: { th: 'อาลักษณ์', ab: ['dex', 'int', 'wis'], sk: ['investigation', 'perception'], tool: "Calligrapher's Supplies", feat: 'Skilled' },
  Soldier: { th: 'ทหาร', ab: ['str', 'dex', 'con'], sk: ['athletics', 'intimidation'], tool: 'Gaming Set (1 ชนิด)', feat: 'Savage Attacker' },
  Wayfarer: { th: 'นักเดินทาง', ab: ['dex', 'wis', 'cha'], sk: ['insight', 'stealth'], tool: "Thieves' Tools", feat: 'Lucky' },
};
const COIN_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
function loadOf(c) {
  const coins = Object.values(c.coins).reduce((a, n) => a + n, 0) / 50;
  return c.items.reduce((a, i) => a + i.qty * i.weight, 0) + coins;
}

const mod = s => Math.floor((s - 10) / 2);
const profBonus = lvl => Math.ceil(lvl / 4) + 1;

const hasFeat = (c, f) => (c.feats || []).includes(f) || BACKGROUNDS[c.background]?.feat === f;
const initBonus = c => mod(c.scores.dex) + (hasFeat(c, 'Alert') ? profBonus(c.level) : 0);

function maxHp(c) {
  if (c.hpMaxOverride != null) return c.hpMaxOverride;
  const hd = CLASSES[c.cls].hd;
  const cm = mod(c.scores.con);
  return Math.max(1, hd + cm + (c.level - 1) * Math.max(1, Math.floor(hd / 2) + 1 + cm)) + (hasFeat(c, 'Tough') ? 2 * c.level : 0);
}
// ทักษะที่เลือกได้ตอนสร้างตัวละคร (PHB 2024) — n = จำนวนที่เลือก, from = ตัวเลือก (null = เลือกได้ทุกทักษะ)
const CLASS_SKILLS = {
  Barbarian: { n: 2, from: ['animal', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] },
  Bard: { n: 3, from: null },
  Cleric: { n: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  Druid: { n: 2, from: ['arcana', 'animal', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'] },
  Fighter: { n: 2, from: ['acrobatics', 'animal', 'athletics', 'history', 'insight', 'intimidation', 'persuasion', 'perception', 'survival'] },
  Monk: { n: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  Paladin: { n: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  Ranger: { n: 3, from: ['animal', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'] },
  Rogue: { n: 4, from: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'persuasion', 'sleight', 'stealth'] },
  Sorcerer: { n: 2, from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'] },
  Warlock: { n: 2, from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'] },
  Wizard: { n: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'nature', 'religion'] },
};
// การฝึกใช้เกราะของอาชีพ: l = เบา, m = กลาง, h = หนัก, s = โล่
const ARMOR_TRAIN = {
  Barbarian: 'lms', Bard: 'l', Cleric: 'lms', Druid: 'ls', Fighter: 'lmhs', Monk: '', Paladin: 'lmhs',
  Ranger: 'lms', Rogue: 'l', Sorcerer: '', Warlock: 'l', Wizard: '',
};
// ชุดเกราะตาราง Armor ของ PHB 2024: cat = ประเภท, ac = AC ฐาน, cap = เพดานโมดิฟายเออร์ DEX (null = ไม่จำกัด, 0 = ไม่บวก DEX), str = STR ขั้นต่ำ, stealth = เสียเปรียบ Stealth
const ARMORS = {
  Padded: { th: 'Padded (เบา)', cat: 'l', ac: 11, cap: null, stealth: true },
  Leather: { th: 'Leather (เบา)', cat: 'l', ac: 11, cap: null },
  Studded: { th: 'Studded Leather (เบา)', cat: 'l', ac: 12, cap: null },
  Hide: { th: 'Hide (กลาง)', cat: 'm', ac: 12, cap: 2 },
  ChainShirt: { th: 'Chain Shirt (กลาง)', cat: 'm', ac: 13, cap: 2 },
  ScaleMail: { th: 'Scale Mail (กลาง)', cat: 'm', ac: 14, cap: 2, stealth: true },
  Breastplate: { th: 'Breastplate (กลาง)', cat: 'm', ac: 14, cap: 2 },
  HalfPlate: { th: 'Half Plate (กลาง)', cat: 'm', ac: 15, cap: 2, stealth: true },
  RingMail: { th: 'Ring Mail (หนัก)', cat: 'h', ac: 14, cap: 0, stealth: true },
  ChainMail: { th: 'Chain Mail (หนัก)', cat: 'h', ac: 16, cap: 0, str: 13, stealth: true },
  Splint: { th: 'Splint (หนัก)', cat: 'h', ac: 17, cap: 0, str: 15, stealth: true },
  Plate: { th: 'Plate (หนัก)', cat: 'h', ac: 18, cap: 0, str: 15, stealth: true },
};
function autoAc(c) {
  const dex = mod(c.scores.dex);
  const a = ARMORS[c.armor];
  let ac;
  if (a) ac = a.ac + (a.cap === 0 ? 0 : a.cap == null ? dex : Math.min(dex, a.cap));
  else if (c.cls === 'Barbarian') ac = 10 + dex + mod(c.scores.con); // Unarmored Defense
  else if (c.cls === 'Monk' && !c.shield) ac = 10 + dex + mod(c.scores.wis);
  else ac = 10 + dex;
  return ac + (c.shield ? 2 : 0) + (a && c.feats.includes('Defense') ? 1 : 0);
}
const skillBonus = (c, s) => mod(c.scores[s.ab]) + profBonus(c.level) * (c.skills[s.k] || 0);


/* ===== PHB 2024: อาวุธ + Weapon Mastery + Feat (เฉพาะชื่อ/ตัวเลข) ===== */
// [ชื่อ, ดาเมจ, ประเภท(S/P/B), คุณสมบัติ, Mastery, หมวด]  หมวด: sm=Simple Melee, sr=Simple Ranged, mm=Martial Melee, mr=Martial Ranged
const WEAPONS = [
  ['Club','1d4','B','Light','Slow','sm'],['Dagger','1d4','P','Finesse,Light,Thrown','Nick','sm'],
  ['Greatclub','1d8','B','Two-Handed','Push','sm'],['Handaxe','1d6','S','Light,Thrown','Vex','sm'],
  ['Javelin','1d6','P','Thrown','Slow','sm'],['Light Hammer','1d4','B','Light,Thrown','Nick','sm'],
  ['Mace','1d6','B','','Sap','sm'],['Quarterstaff','1d6','B','Versatile 1d8','Topple','sm'],
  ['Sickle','1d4','S','Light','Nick','sm'],['Spear','1d6','P','Thrown,Versatile 1d8','Sap','sm'],
  ['Dart','1d4','P','Finesse,Thrown','Vex','sr'],['Light Crossbow','1d8','P','Ammunition,Loading,Two-Handed','Slow','sr'],
  ['Shortbow','1d6','P','Ammunition,Two-Handed','Vex','sr'],['Sling','1d4','B','Ammunition','Slow','sr'],
  ['Battleaxe','1d8','S','Versatile 1d10','Topple','mm'],['Flail','1d8','B','','Sap','mm'],
  ['Glaive','1d10','S','Heavy,Reach,Two-Handed','Graze','mm'],['Greataxe','1d12','S','Heavy,Two-Handed','Cleave','mm'],
  ['Greatsword','2d6','S','Heavy,Two-Handed','Graze','mm'],['Halberd','1d10','S','Heavy,Reach,Two-Handed','Cleave','mm'],
  ['Lance','1d10','P','Heavy,Reach','Topple','mm'],['Longsword','1d8','S','Versatile 1d10','Sap','mm'],
  ['Maul','2d6','B','Heavy,Two-Handed','Topple','mm'],['Morningstar','1d8','P','','Sap','mm'],
  ['Pike','1d10','P','Heavy,Reach,Two-Handed','Push','mm'],['Rapier','1d8','P','Finesse','Vex','mm'],
  ['Scimitar','1d6','S','Finesse,Light','Nick','mm'],['Shortsword','1d6','P','Finesse,Light','Vex','mm'],
  ['Trident','1d8','P','Thrown,Versatile 1d10','Topple','mm'],['Warhammer','1d8','B','Versatile 1d10','Push','mm'],
  ['War Pick','1d8','P','Versatile 1d10','Sap','mm'],['Whip','1d4','S','Finesse,Reach','Slow','mm'],
  ['Blowgun','1','P','Ammunition,Loading','Vex','mr'],['Hand Crossbow','1d6','P','Ammunition,Light,Loading','Vex','mr'],
  ['Heavy Crossbow','1d10','P','Ammunition,Heavy,Loading,Two-Handed','Push','mr'],['Longbow','1d8','P','Ammunition,Heavy,Two-Handed','Slow','mr'],
  ['Musket','1d12','P','Ammunition,Loading,Two-Handed','Slow','mr'],['Pistol','1d10','P','Ammunition,Loading','Vex','mr'],
].map(([name, die, type, props, mastery, cat]) => ({ name, die, type, props, mastery, cat, ranged: cat === 'sr' || cat === 'mr' }));
const WEAPON_BY = Object.fromEntries(WEAPONS.map(w => [w.name, w]));
const WCAT = { sm: 'Simple Melee', sr: 'Simple Ranged', mm: 'Martial Melee', mr: 'Martial Ranged' };
const MARTIAL_CLS = ['Barbarian', 'Fighter', 'Paladin', 'Ranger'];
function weaponProf(c, w) {
  if (w.cat === 'sm' || w.cat === 'sr') return true;
  if (MARTIAL_CLS.includes(c.cls)) return true;
  const p = w.props;
  if (c.cls === 'Monk') return !w.ranged && /Light/.test(p);
  if (c.cls === 'Rogue') return !w.ranged && /Light|Finesse/.test(p);
  return false;
}
function weaponCalc(c, w) {
  const finesse = /Finesse/.test(w.props);
  const m = w.ranged ? mod(c.scores.dex) : finesse ? Math.max(mod(c.scores.str), mod(c.scores.dex)) : mod(c.scores.str);
  const prof = weaponProf(c, w);
  const bonus = m + (prof ? profBonus(c.level) : 0);
  const dmg = w.die + (m ? (m > 0 ? '+' : '-') + Math.abs(m) : '');
  return { bonus, dmg, prof };
}
const FEATS = {
  origin: ['Alert', 'Crafter', 'Healer', 'Lucky', 'Magic Initiate', 'Musician', 'Savage Attacker', 'Skilled', 'Tavern Brawler', 'Tough'],
  general: ['Ability Score Improvement', 'Actor', 'Athlete', 'Charger', 'Chef', 'Crossbow Expert', 'Crusher', 'Defensive Duelist', 'Dual Wielder', 'Durable', 'Elemental Adept', 'Fey-Touched', 'Grappler', 'Great Weapon Master', 'Heavily Armored', 'Heavy Armor Master', 'Inspiring Leader', 'Keen Mind', 'Lightly Armored', 'Mage Slayer', 'Martial Weapon Training', 'Medium Armor Master', 'Moderately Armored', 'Mounted Combatant', 'Observant', 'Piercer', 'Poisoner', 'Polearm Master', 'Resilient', 'Ritual Caster', 'Sentinel', 'Shadow-Touched', 'Sharpshooter', 'Shield Master', 'Skill Expert', 'Skulker', 'Slasher', 'Speedster', 'Spell Sniper', 'Telekinetic', 'Telepathic', 'War Caster'],
  style: ['Archery', 'Blessed Warrior', 'Blind Fighting', 'Defense', 'Druidic Warrior', 'Dueling', 'Great Weapon Fighting', 'Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Unarmed Fighting'],
  epic: ['Boon of Combat Prowess', 'Boon of Dimensional Travel', 'Boon of Fate', 'Boon of Fortitude', 'Boon of Irresistible Offense', 'Boon of Energy Resistance', 'Boon of Recovery', 'Boon of Skill', 'Boon of Speed', 'Boon of Spell Recall', 'Boon of the Night Spirit', 'Boon of Truesight'],
};
const FEAT_CAT = { origin: 'Origin (เลเวล 1)', general: 'General (เลเวล 4+)', style: 'Fighting Style', epic: 'Epic Boon (เลเวล 19+)' };
const FEAT_ALL = new Set(Object.values(FEATS).flat());
const FEAT_NOTE = {
  'Tough': 'HP สูงสุด +2 ต่อเลเวล (นับให้อัตโนมัติ)',
  'Ability Score Improvement': '+2 ค่าสถานะหนึ่งอย่าง หรือ +1 สองอย่าง (แก้ค่าเอง)',
  'Alert': 'Initiative + โบนัสชำนาญ (นับให้ใน Initiative)',
  'Archery': 'โจมตีไกล +2 (นับให้ในตารางอาวุธ)',
  'Dueling': 'ถืออาวุธมือเดียว ดาเมจ +2 (นับให้ในตารางอาวุธ)',
  'Defense': 'ใส่เกราะ AC +1 (นับให้อัตโนมัติ)',
};

/* =====================================================================
   ตัวละคร (เก็บใน localStorage)
   ===================================================================== */
const blankChar = () => ({
  id: uid8(), name: '', race: '', cls: 'Fighter', level: 1, background: '',
  scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  saves: { str: true, con: true }, skills: {},
  acOverride: null, speed: 30, hpMaxOverride: null, hp: null,
  attacks: [], notes: '',
  armor: '', shield: false,
  raceBonus: {}, bgAsi: { mode: '21', a2: '', a1: '' }, bgSkills: [],
  spellAb: '', spells: [], slotsMax: {}, slotsUsed: {},
  items: [], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  feats: [],
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
    ? o.attacks.slice(0, 30).map(a => ({ id: uid8(), name: String(a.name || ''), bonus: Number(a.bonus) || 0, dmg: String(a.dmg || ''), w: WEAPON_BY[a.w] ? a.w : '' }))
    : [];
  c.bgAsi = { mode: o.bgAsi?.mode === '111' ? '111' : '21', a2: ABILITIES.some(a => a.k === o.bgAsi?.a2) ? o.bgAsi.a2 : '', a1: ABILITIES.some(a => a.k === o.bgAsi?.a1) ? o.bgAsi.a1 : '' };
  c.bgSkills = Array.isArray(o.bgSkills) ? o.bgSkills.filter(k => SKILLS.some(s => s.k === k)) : [];
  c.feats = Array.isArray(o.feats) ? [...new Set(o.feats.filter(f => FEAT_ALL.has(f)))].slice(0, 20) : [];
  c.armor = ARMORS[o.armor] ? o.armor : '';
  c.shield = !!o.shield;
  c.raceBonus = {};
  ABILITIES.forEach(a => { const v = Math.round(Number(o.raceBonus?.[a.k])); if (v) c.raceBonus[a.k] = clamp(v, -5, 5); });
  const num = (v, a, b) => clamp(Number(v) || 0, a, b);
  c.spellAb = ABILITIES.some(a => a.k === o.spellAb) ? o.spellAb : '';
  c.spells = Array.isArray(o.spells)
    ? o.spells.slice(0, 200).map(x => ({ id: uid8(), name: String(x.name || '').slice(0, 60), lvl: Math.round(num(x.lvl, 0, 9)), prep: !!x.prep, dmg: String(x.dmg || '').slice(0, 30) }))
    : [];
  c.slotsMax = {}; c.slotsUsed = {};
  for (let l = 1; l <= 9; l++) {
    const m = o.slotsMax?.[l];
    if (m != null && m !== '' && Number.isFinite(Number(m))) c.slotsMax[l] = Math.round(num(m, 0, 20));
    const u = o.slotsUsed?.[l];
    if (u != null && Number.isFinite(Number(u))) c.slotsUsed[l] = Math.round(num(u, 0, 20));
  }
  c.items = Array.isArray(o.items)
    ? o.items.slice(0, 200).map(x => ({ id: uid8(), name: String(x.name || '').slice(0, 60), qty: Math.round(num(x.qty, 0, 9999)), weight: num(x.weight, 0, 9999), eq: !!x.eq }))
    : [];
  c.coins = {};
  ['cp', 'sp', 'ep', 'gp', 'pp'].forEach(k => { c.coins[k] = Math.round(num(o.coins?.[k], 0, 99999999)); });
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
const room = { code: null, uid: null, isDM: false, name: store.get('name', ''), unsubs: [], dm: null, scenes: {}, sceneUnsubs: [] };
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
  const m0 = snap.val() || {};

  leaveRoom(true);
  unsubscribeScene();
  room.code = code;
  room.uid = uid;
  room.dm = m0.dm || null;
  room.scenes = m0.scenes && typeof m0.scenes === 'object' ? m0.scenes : {};
  scene = m0.scene && (m0.scene === 'main' || room.scenes[m0.scene]) ? m0.scene : 'main';
  resetSceneState();
  initState = normInit({});
  remoteRulers = {};
  pings = [];
  $('#logList').innerHTML = '';

  const u = room.unsubs;
  u.push(D.onValue(roomRef('meta'), s => {
    const m = s.val() || {};
    room.isDM = m.dm === uid;
    room.dm = m.dm || null;
    room.scenes = m.scenes && typeof m.scenes === 'object' ? m.scenes : {};
    bgUrl = typeof m.bg === 'string' ? m.bg : '';
    loadBg();
    const want = m.scene && (m.scene === 'main' || room.scenes[m.scene]) ? m.scene : 'main';
    if (want !== scene) switchScene(want);
    updateRoomUI();
    renderScenes();
  }));

  u.push(D.onChildAdded(D.query(roomRef('rolls'), D.limitToLast(40)), s => {
    const r = s.val();
    if (!r || typeof r.total !== 'number') return;
    addLog(r);
    if (Date.now() - (r.ts || 0) < 6000) showResult(r);
  }));

  u.push(D.onValue(roomRef('chars'), s => { party = s.val() || {}; renderParty(); }));

  u.push(D.onValue(roomRef('init'), s => {
    const prev = initState.turn;
    initState = normInit(s.val() || {});
    renderInit(); draw();
    if (initState.turn && initState.turn !== prev) announceTurn();
  }));

  let firstPing = true;
  u.push(D.onValue(roomRef('ping'), s => {
    const p = s.val();
    if (firstPing) { firstPing = false; return; }
    if (p && p.from !== uid && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y))) addPing(p);
  }));

  u.push(D.onValue(roomRef('rulers'), s => {
    remoteRulers = s.val() || {};
    delete remoteRulers[uid];
    draw();
  }));

  u.push(D.onValue(D.ref(db, '.info/connected'), s => {
    if (!s.val() || !room.code) return;
    D.onDisconnect(roomRef(`chars/${uid}`)).remove();
    D.onDisconnect(roomRef(`rulers/${uid}`)).remove();
    syncMyChar();
  }));

  subscribeScene();
  store.set('room', code);
  updateRoomUI();
  renderScenes(); renderTokenList(); renderMapList(); renderInit(); updateSelBar(); draw();
}

/* ฟังข้อมูลของฉากปัจจุบัน (โทเคน รูป หมอก เส้นวาด) */
function subscribeScene() {
  const { D } = fb;
  const u = room.sceneUnsubs = [];

  u.push(D.onValue(sref('fog'), s => {
    const v = s.val();
    if (!(tool === 'fog' && fogDirty)) { fog = typeof v === 'string' && v.length === GRID * GRID ? v : ''; draw(); }
  }));

  const tref = sref('tokens');
  const put = s => { tokens[s.key] = normToken(s.val(), s.key); renderTokenList(); updateSelBar(); draw(); };
  u.push(D.onChildAdded(tref, put));
  u.push(D.onChildChanged(tref, put));
  u.push(D.onChildRemoved(tref, s => {
    delete tokens[s.key];
    delete tokImgs[s.key];
    if (selected === s.key) selected = null;
    renderTokenList(); updateSelBar(); draw();
  }));
  const tiref = sref('tokimg');
  const putTi = s => loadTokImg(s.key, s.val());
  u.push(D.onChildAdded(tiref, putTi));
  u.push(D.onChildChanged(tiref, putTi));
  u.push(D.onChildRemoved(tiref, s => { delete tokImgs[s.key]; draw(); }));

  const mref = sref('maps');
  const putMap = s => { maps[s.key] = normMap(s.val(), s.key); renderMapList(); updateSelBar(); draw(); };
  u.push(D.onChildAdded(mref, putMap));
  u.push(D.onChildChanged(mref, putMap));
  u.push(D.onChildRemoved(mref, s => {
    delete maps[s.key];
    delete imgs[s.key];
    if (selectedMap === s.key) selectedMap = null;
    renderMapList(); updateSelBar(); draw();
  }));
  const iref = sref('mapimg');
  const putImg = s => loadImg(s.key, s.val());
  u.push(D.onChildAdded(iref, putImg));
  u.push(D.onChildChanged(iref, putImg));
  u.push(D.onChildRemoved(iref, s => { delete imgs[s.key]; draw(); }));

  const dref = sref('draw');
  const putDraw = s => { draws[s.key] = normDraw(s.val(), s.key); draw(); };
  u.push(D.onChildAdded(dref, putDraw));
  u.push(D.onChildChanged(dref, putDraw));
  u.push(D.onChildRemoved(dref, s => { delete draws[s.key]; draw(); }));
}
function unsubscribeScene() {
  (room.sceneUnsubs || []).forEach(f => { try { f(); } catch { /* ignore */ } });
  room.sceneUnsubs = [];
}

function resetSceneState() {
  tokens = {}; selected = null;
  maps = {}; selectedMap = null;
  draws = {}; draft = null; tdrag = null; ruler = null;
  fog = '';
  if (tool === 'fog') setTool('move');
  Object.keys(imgs).forEach(k => delete imgs[k]);
  Object.keys(tokImgs).forEach(k => delete tokImgs[k]);
}

function loadLocalScene() {
  tokens = loadLocalTokens();
  maps = loadLocalMaps();
  fog = store.get(lk('fog'), '');
  if (typeof fog !== 'string' || (fog && fog.length !== GRID * GRID)) fog = '';
  draws = loadLocalDraws();
  rebuildLocalImgs();
  Object.values(tokens).forEach(t => { if (t.imgSrc) loadTokImg(t.id, t.imgSrc); });
}

function switchScene(id) {
  if (id === scene) return;
  unsubscribeScene();
  scene = id;
  resetSceneState();
  if (online()) subscribeScene(); else loadLocalScene();
  renderScenes(); renderTokenList(); renderMapList(); updateSelBar(); renderInit(); draw();
  toast(`ฉาก: ${sceneName(id)}`, 2500);
}

function leaveRoom(silent) {
  if (fb && room.code && !silent) {
    fb.D.remove(roomRef(`chars/${room.uid}`)).catch(() => {});
    fb.D.remove(roomRef(`rulers/${room.uid}`)).catch(() => {});
  }
  room.unsubs.forEach(f => { try { f(); } catch { /* ignore */ } });
  room.unsubs = [];
  unsubscribeScene();
  room.code = null;
  room.isDM = false;
  room.dm = null;
  room.scenes = {};
  party = {};
  remoteRulers = {};
  if (!silent) {
    store.set('room', null);
    const sv = store.get('scene', 'main');
    scene = sv === 'main' || scenes[sv] ? sv : 'main';
    resetSceneState();
    loadLocalScene();
    initState = loadLocalInit();
    bgUrl = store.get('bg', '');
    loadBg();
    $('#logList').innerHTML = '';
    renderTokenList(); renderMapList(); renderParty(); updateSelBar(); updateRoomUI(); renderScenes(); renderInit(); draw();
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
    init: initBonus(c),
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
  saveT = setTimeout(() => { syncMyChar(); pushCharToTokens(); }, 400);
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

  const armSel = $('#f-armor');
  armSel.append(h('option', { value: '', text: 'ไม่สวมเกราะ' }));
  Object.entries(ARMORS).forEach(([k, v]) => armSel.append(h('option', { value: k, text: v.th })));
  $('#f-shield').addEventListener('change', e => { cur().shield = e.target.checked; changed(); });

  // เผ่า (2024): ตั้งความเร็วให้ / ภูมิหลัง: โบนัสสถานะ + ทักษะชำนาญ 2 อย่าง
  const raceSel = $('#f-race');
  raceSel.append(h('option', { value: '', text: '— เลือกเผ่า —' }));
  Object.entries(SPECIES).forEach(([k, v]) => raceSel.append(h('option', { value: k, text: `${v.th} (${k})` })));
  raceSel.addEventListener('change', () => {
    const r = SPECIES[raceSel.value];
    if (r) { cur().speed = r.speed; renderSheet(); }
    changed();
  });
  const bgSel = $('#f-bg');
  bgSel.append(h('option', { value: '', text: '— เลือกภูมิหลัง —' }));
  Object.entries(BACKGROUNDS).forEach(([k, v]) => bgSel.append(h('option', { value: k, text: `${v.th} (${k})` })));
  const abName = k => ABILITIES.find(a => a.k === k).en;
  const fillAsi = () => {
    const c = cur(), bg = BACKGROUNDS[bgSel.value];
    $('#bgAsi').hidden = !bg;
    if (!bg) return;
    ['#bgA2', '#bgA1'].forEach(id => {
      const sel = $(id);
      sel.innerHTML = '';
      bg.ab.forEach(k => sel.append(h('option', { value: k, text: `${id === '#bgA2' ? '+2' : '+1'} ${abName(k)}` })));
    });
    if (!bg.ab.includes(c.bgAsi.a2)) c.bgAsi.a2 = bg.ab[0];
    if (!bg.ab.includes(c.bgAsi.a1) || c.bgAsi.a1 === c.bgAsi.a2) c.bgAsi.a1 = bg.ab.find(k => k !== c.bgAsi.a2);
    $('#bgMode').value = c.bgAsi.mode; $('#bgA2').value = c.bgAsi.a2; $('#bgA1').value = c.bgAsi.a1;
    $('#bgA2').hidden = $('#bgA1').hidden = c.bgAsi.mode === '111';
  };
  const applyBackground = () => {
    const c = cur();
    const old = c.raceBonus || {};
    ABILITIES.forEach(a => { if (old[a.k]) c.scores[a.k] = clamp(c.scores[a.k] - old[a.k], 1, 30); });
    c.bgSkills.forEach(k => { if (c.skills[k] === 1) c.skills[k] = 0; });
    c.bgSkills = [];
    const bg = BACKGROUNDS[bgSel.value];
    c.raceBonus = {};
    if (bg) {
      fillAsi();
      if (c.bgAsi.mode === '111') bg.ab.forEach(k => { c.raceBonus[k] = 1; });
      else { c.raceBonus[c.bgAsi.a2] = 2; c.raceBonus[c.bgAsi.a1] = 1; }
      bg.sk.forEach(k => { if (!c.skills[k]) { c.skills[k] = 1; c.bgSkills.push(k); } });
    } else $('#bgAsi').hidden = true;
    ABILITIES.forEach(a => { if (c.raceBonus[a.k]) c.scores[a.k] = clamp(c.scores[a.k] + c.raceBonus[a.k], 1, 30); });
    c.background = bgSel.value;
    renderSheet(); changed();
  };
  bgSel.addEventListener('change', applyBackground);
  $('#bgMode').addEventListener('change', e => { cur().bgAsi.mode = e.target.value; applyBackground(); });
  $('#bgA2').addEventListener('change', e => { cur().bgAsi.a2 = e.target.value; if (cur().bgAsi.a1 === e.target.value) cur().bgAsi.a1 = ''; applyBackground(); });
  $('#bgA1').addEventListener('change', e => { cur().bgAsi.a1 = e.target.value; if (cur().bgAsi.a2 === e.target.value) cur().bgAsi.a2 = ''; applyBackground(); });
  fillAsiRef = fillAsi;

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
    CLASSES[c.cls].pri.forEach((k, i) => { c.scores[k] = clamp(sorted[i] + (c.raceBonus[k] || 0), 1, 30); });
    renderSheet(); changed();
  };
  $('#abRoll').onclick = () => {
    const roll = () => { const r = [rnd(6), rnd(6), rnd(6), rnd(6)].sort((a, b) => a - b); return r[1] + r[2] + r[3]; };
    const vals = Array.from({ length: 6 }, roll);
    assign(vals);
    toast(`สุ่มได้ ${[...vals].sort((a, b) => b - a).join(', ')} (จัดตามอาชีพให้แล้ว แก้ได้)`, 5000);
  };
  $('#abStd').onclick = () => assign([15, 14, 13, 12, 10, 8]);
  $('#abReset').onclick = () => { ABILITIES.forEach(a => { cur().scores[a.k] = 10 + (cur().raceBonus[a.k] || 0); }); renderSheet(); changed(); };

  // Initiative / HP
  $('#init').onclick = () => emitRoll('Initiative', bonusExpr(initBonus(cur())));
  $$('[data-hp]').forEach(b => b.addEventListener('click', () => {
    const c = cur();
    const mh = maxHp(c);
    c.hp = clamp((c.hp ?? mh) + Number(b.dataset.hp), 0, mh + 999);
    $('#f-hp').value = c.hp;
    changed();
  }));
  $('#hpFull').onclick = () => { cur().hp = null; $('#f-hp').value = maxHp(cur()); changed(); };

  // เวทมนตร์ / กระเป๋า
  $('#spellAdd').onclick = () => {
    const c = cur();
    c.spells.push({ id: uid8(), name: '', lvl: 1, prep: false, dmg: '' });
    renderSpells(); changed();
  };
  $('#slotEdit').onclick = () => { slotEditing = !slotEditing; $('#slotEdit').classList.toggle('on', slotEditing); renderSlots(); };
  $('#slotReset').onclick = () => { cur().slotsUsed = {}; renderSlots(); changed(); toast('คืนช่องเวทครบแล้ว'); };
  $('#spAtk').onclick = () => {
    const c = cur(), ab = spellAb(c);
    if (!ab) { toast('เลือก "ค่าร่ายเวท" ก่อน'); return; }
    emitRoll('โจมตีด้วยเวท', bonusExpr(profBonus(c.level) + mod(c.scores[ab])));
  };
  $('#itemAdd').onclick = () => { cur().items.push({ id: uid8(), name: '', qty: 1, weight: 0, eq: false }); renderInventory(); changed(); };
  $('#coins').append(...['pp', 'gp', 'ep', 'sp', 'cp'].map(k => h('label', {},
    k.toUpperCase(),
    h('input', { type: 'number', min: 0, inputmode: 'numeric', 'data-coin': k, oninput: e => { cur().coins[k] = Math.max(0, Math.round(Number(e.target.value) || 0)); changed(); } }))));

  // อาวุธ
  bindFeats();
  $('#atkRecalc').onclick = () => { recalcWeapons(); changed(); };
  $('#atkAdd').onclick = () => {
    const c = cur();
    const m = mod(c.scores.str);
    c.attacks.push({ id: uid8(), name: '', bonus: m + profBonus(c.level), dmg: `1d8${m >= 0 ? '+' : '-'}${Math.abs(m)}` });
    renderAttacks(); changed();
  };
}

function styleBonus(c, w) {
  let b = 0, d = 0;
  if (c.feats.includes('Archery') && w.ranged) b += 2;
  if (c.feats.includes('Dueling') && !w.ranged && !/Two-Handed/.test(w.props)) d += 2;
  return { b, d };
}
function applyWeapon(c, a) {
  const w = WEAPON_BY[a.w];
  if (!w) return;
  const r = weaponCalc(c, w), s = styleBonus(c, w);
  a.bonus = r.bonus + s.b;
  a.dmg = r.dmg + (s.d ? `+${s.d}` : '');
  if (!a.name) a.name = w.name;
}
function renderAttacks() {
  const box = $('#attacks');
  box.innerHTML = '';
  const c = cur();
  c.attacks.forEach(a => {
    const sel = h('select', { class: 'wsel', title: 'เลือกอาวุธ PHB 2024 (คำนวณโบนัส/ดาเมจให้)' },
      h('option', { value: '', text: '— อาวุธเอง —' }),
      ...Object.entries(WCAT).map(([k, t]) => h('optgroup', { label: t }, ...WEAPONS.filter(w => w.cat === k).map(w => h('option', { value: w.name, text: `${w.name} (${w.die})` })))));
    sel.value = a.w || '';
    const w = WEAPON_BY[a.w];
    const info = h('div', { class: 'hint winfo', style: w ? '' : 'display:none' });
    const showInfo = () => {
      const ww = WEAPON_BY[a.w];
      if (!ww) { info.style.display = 'none'; return; }
      info.style.display = '';
      info.textContent = `${ww.die} ${ww.type === 'S' ? 'Slashing' : ww.type === 'P' ? 'Piercing' : 'Bludgeoning'}${ww.props ? ' · ' + ww.props.replace(/,/g, ', ') : ''} · Mastery: ${ww.mastery}${weaponProf(c, ww) ? '' : ' · ⚠ ไม่ชำนาญ'}`;
    };
    showInfo();
    const nm = h('input', { placeholder: 'ชื่ออาวุธ/สกิล', value: a.name, oninput: e => { a.name = e.target.value; changed(); } });
    const bn = h('input', { type: 'number', class: 'sm', title: 'โบนัสโจมตี', value: a.bonus, inputmode: 'numeric', oninput: e => { a.bonus = Number(e.target.value) || 0; changed(); } });
    const dm = h('input', { class: 'sm', placeholder: 'ดาเมจ เช่น 1d8+3', value: a.dmg, oninput: e => { a.dmg = e.target.value; changed(); } });
    sel.onchange = () => {
      a.w = sel.value;
      if (a.w) { if (!a.name || WEAPON_BY[a.name]) a.name = ''; applyWeapon(c, a); nm.value = a.name; bn.value = a.bonus; dm.value = a.dmg; }
      showInfo(); changed();
    };
    box.append(h('div', { class: 'atk' },
      sel, h('span'), h('span'),
      nm, bn, dm, info,
      h('div', { class: 'atk-btns' },
        h('button', { text: '⚔ โจมตี', onclick: () => emitRoll(`${a.name || 'โจมตี'} (โจมตี)`, bonusExpr(a.bonus)) }),
        h('button', { text: '💥 ดาเมจ', onclick: () => emitRoll(`${a.name || 'ดาเมจ'} (ดาเมจ)`, a.dmg || '1d4') }),
        h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => { c.attacks = c.attacks.filter(x => x !== a); renderAttacks(); changed(); } }))));
  });
}
function recalcWeapons() {
  const c = cur();
  c.attacks.forEach(a => { if (a.w) applyWeapon(c, a); });
  renderAttacks();
}

function featList(c) {
  const bg = BACKGROUNDS[c.background];
  const out = [];
  if (bg) out.push({ name: bg.feat, from: 'ภูมิหลัง' });
  c.feats.forEach(f => out.push({ name: f, from: '', own: true }));
  return out;
}
function renderFeats() {
  const c = cur();
  const box = $('#featList');
  if (!box) return;
  box.innerHTML = '';
  const list = featList(c);
  if (!list.length) box.append(h('p', { class: 'hint', text: 'ยังไม่มี Feat — เลือกภูมิหลังเพื่อรับ Origin Feat หรือเพิ่มเอง' }));
  list.forEach(f => {
    const base = f.name.replace(/ \(.*\)$/, '');
    const cat = Object.keys(FEATS).find(k => FEATS[k].includes(base));
    box.append(h('div', { class: 'feat' },
      h('div', {}, h('b', { text: f.name }), h('span', { class: 'hint', text: ` ${cat ? FEAT_CAT[cat] : ''}${f.from ? ' · จาก' + f.from : ''}` }),
        FEAT_NOTE[base] ? h('div', { class: 'hint', text: FEAT_NOTE[base] }) : null),
      f.own ? h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => { c.feats = c.feats.filter(x => x !== f.name); renderFeats(); recalcWeapons(); refreshDerived(); changed(); } }) : null));
  });
}
function bindFeats() {
  const sel = $('#featSel');
  sel.append(h('option', { value: '', text: '— เลือก Feat —' }),
    ...Object.entries(FEATS).map(([k, arr]) => h('optgroup', { label: FEAT_CAT[k] }, ...arr.map(f => h('option', { value: f, text: f })))));
  $('#featAdd').onclick = () => {
    const c = cur(), f = sel.value;
    if (!f || c.feats.includes(f)) return;
    c.feats.push(f); sel.value = '';
    renderFeats(); recalcWeapons(); refreshDerived(); changed();
  };
}

let slotEditing = false;
let fillAsiRef = () => {};

function refreshArmorSkills() {
  const c = cur();
  const a = ARMORS[c.armor];
  const tr = ARMOR_TRAIN[c.cls] || '';
  const notes = [];
  if (a && !tr.includes(a.cat)) notes.push('⚠ อาชีพนี้ไม่ได้ฝึกเกราะประเภทนี้: เสียเปรียบเช็ค STR/DEX และร่ายเวทไม่ได้');
  if (c.shield && !tr.includes('s')) notes.push('⚠ อาชีพนี้ไม่ได้ฝึกใช้โล่ (ไม่ได้ AC จากโล่ตามกฎ)');
  if (a?.str && c.scores.str < a.str) notes.push(`STR ไม่ถึง ${a.str}: ความเร็วลด 10 ft`);
  if (a?.stealth) notes.push('เสียเปรียบเช็ค Stealth');
  if (!a && c.cls === 'Barbarian') notes.push('Unarmored Defense: 10 + DEX + CON');
  if (!a && c.cls === 'Monk') notes.push(c.shield ? 'ถือโล่แล้วใช้ Unarmored Defense ของ Monk ไม่ได้' : 'Unarmored Defense: 10 + DEX + WIS');
  $('#armorHint').textContent = `AC อัตโนมัติ ${autoAc(c)}${notes.length ? ' · ' + notes.join(' · ') : ''}`;

  const cs = CLASS_SKILLS[c.cls];
  const allowed = k => !cs.from || cs.from.includes(k);
  SKILLS.forEach(s => $('#sk-' + s.k).classList.toggle('cls-ok', allowed(s.k)));
  const chosen = SKILLS.filter(s => (c.skills[s.k] || 0) >= 1 && allowed(s.k) && !c.bgSkills.includes(s.k)).length;
  const list = cs.from ? cs.from.map(k => SKILLS.find(s => s.k === k).th).join(', ') : 'ทักษะใดก็ได้';
  $('#clsSkillHint').textContent = `ทักษะอาชีพ (★): เลือก ${cs.n} จาก ${list} · เลือกแล้ว ${chosen}/${cs.n}${chosen > cs.n ? ' (เกินที่กฎให้)' : ''} · ทักษะจากภูมิหลังไม่นับ`;
}

function refreshSpellStats() {
  const c = cur(), ab = spellAb(c);
  $('#spDc').textContent = ab ? 8 + profBonus(c.level) + mod(c.scores[ab]) : '–';
  $('#spAtk').textContent = ab ? fmt(profBonus(c.level) + mod(c.scores[ab])) : '–';
  renderSlots();
  const pm = prepMax(c);
  const np = c.spells.filter(x => x.lvl > 0 && x.prep).length;
  $('#spPrep').textContent = pm == null ? `${np}` : `${np}/${pm}`;
  $('#spPrep').style.color = pm != null && np > pm ? 'var(--red)' : '';
}

function renderSlots() {
  const c = cur();
  const box = $('#slots');
  box.innerHTML = '';
  for (let l = 1; l <= 9; l++) {
    const max = slotMax(c, l);
    if (!max && !slotEditing) continue;
    const used = clamp(c.slotsUsed[l] || 0, 0, max);
    const pips = h('div', { class: 'pips' });
    for (let i = 0; i < max; i++) {
      pips.append(h('button', {
        class: 'pip' + (i < used ? ' used' : ''), 'aria-label': `ช่องเลเวล ${l} ใบที่ ${i + 1}`,
        onclick: () => { c.slotsUsed[l] = i < used ? i : i + 1; renderSlots(); changed(); },
      }));
    }
    box.append(h('div', { class: 'slot-row' },
      h('span', { class: 'lv', text: `เลเวล ${l}` }), pips,
      slotEditing ? h('input', {
        type: 'number', min: 0, max: 20, inputmode: 'numeric', placeholder: String(autoSlots(c)[l - 1]), title: 'จำนวนช่อง (ว่าง = อัตโนมัติ)',
        value: c.slotsMax[l] ?? '',
        onchange: e => { if (e.target.value === '') delete c.slotsMax[l]; else c.slotsMax[l] = clamp(Math.round(Number(e.target.value) || 0), 0, 20); renderSlots(); changed(); },
      }) : null));
  }
  const any = [1, 2, 3, 4, 5, 6, 7, 8, 9].some(l => slotMax(c, l) > 0);
  $('#slotHint').textContent = any ? (CASTER[c.cls]?.t === 'pact' && !slotEditing ? 'Warlock: ช่องเวทคืนเมื่อพักสั้นหรือพักยาว' : '')
    : 'อาชีพนี้ไม่มีช่องเวทตามปกติ — กด "แก้จำนวน" เพื่อใส่เอง (เช่น Eldritch Knight, เผ่า/ฟีทที่ให้เวท)';
}

function castSpell(c, sp) {
  const name = sp.name || 'เวท';
  let lv = sp.lvl;
  if (sp.lvl > 0) {
    lv = 0;
    for (let l = sp.lvl; l <= 9; l++) if (slotMax(c, l) - (c.slotsUsed[l] || 0) > 0) { lv = l; break; }
    if (!lv) { toast('ช่องเวทหมดแล้ว'); return; }
    c.slotsUsed[lv] = (c.slotsUsed[lv] || 0) + 1;
    renderSlots(); changed();
  }
  if (sp.dmg) emitRoll(`${name} (${lv ? 'เลเวล ' + lv : 'Cantrip'})`, sp.dmg);
  else toast(`ร่าย ${name}${lv ? ` ด้วยช่องเลเวล ${lv}` : ''}`);
}

function renderSpells() {
  const c = cur();
  renderSlots();
  const box = $('#spells');
  box.innerHTML = '';
  c.spells.map((sp, i) => ({ sp, i })).sort((a, b) => a.sp.lvl - b.sp.lvl || a.i - b.i).forEach(({ sp }) => {
    const lvSel = h('select', { title: 'เลเวลเวท', onchange: e => { sp.lvl = Number(e.target.value); renderSpells(); changed(); } },
      ...Array.from({ length: 10 }, (_, l) => h('option', { value: l, text: l === 0 ? 'Cantrip' : `เลเวล ${l}`, selected: l === sp.lvl })));
    box.append(h('div', { class: 'spell' },
      h('input', { placeholder: 'ชื่อเวท', value: sp.name, maxlength: 60, oninput: e => { sp.name = e.target.value; changed(); } }),
      lvSel,
      h('input', { placeholder: 'ดาเมจ/ฮีล เช่น 8d6', value: sp.dmg, oninput: e => { sp.dmg = e.target.value; changed(); } }),
      h('div', { class: 'sp-btns' },
        h('button', { class: 'primary', text: '✨ ร่าย', onclick: () => castSpell(c, sp) }),
        sp.lvl > 0 ? h('label', {}, h('input', { type: 'checkbox', checked: sp.prep, onchange: e => { sp.prep = e.target.checked; refreshSpellStats(); changed(); } }), 'เตรียม') : null,
        h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => { c.spells = c.spells.filter(x => x !== sp); renderSpells(); changed(); } }))));
  });
}

function renderInventory() {
  const c = cur();
  $$('[data-coin]').forEach(el => { el.value = c.coins[el.dataset.coin] || ''; });
  const box = $('#items');
  box.innerHTML = '';
  c.items.forEach(it => {
    box.append(h('div', { class: 'item' },
      h('input', { placeholder: 'ชื่อของ', value: it.name, maxlength: 60, oninput: e => { it.name = e.target.value; changed(); } }),
      h('input', { type: 'number', min: 0, class: 'sm', title: 'จำนวน', value: it.qty, inputmode: 'numeric', oninput: e => { it.qty = Math.max(0, Math.round(Number(e.target.value) || 0)); changed(); } }),
      h('input', { type: 'number', min: 0, step: '0.1', class: 'sm', title: 'น้ำหนักต่อชิ้น (lb)', placeholder: 'lb', value: it.weight || '', inputmode: 'decimal', oninput: e => { it.weight = Math.max(0, Number(e.target.value) || 0); changed(); } }),
      h('label', {}, h('input', { type: 'checkbox', checked: it.eq, onchange: e => { it.eq = e.target.checked; changed(); } }), 'ใช้'),
      h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => { c.items = c.items.filter(x => x !== it); renderInventory(); changed(); } })));
  });
}

function refreshLoad() {
  const c = cur();
  const w = loadOf(c);
  const cap = c.scores.str * 15;
  const r = x => Math.round(x * 10) / 10;
  const gp = Object.entries(c.coins).reduce((a, [k, n]) => a + n * COIN_GP[k], 0);
  const st = w > c.scores.str * 10 ? 'หนักมาก (Heavily Encumbered)' : w > c.scores.str * 5 ? 'เริ่มหนัก (Encumbered)' : 'ปกติ';
  $('#loadTxt').textContent = `น้ำหนักรวม ${r(w)} / ${cap} lb (STR×15) · สถานะ: ${st} · เงินทั้งหมด ≈ ${r(gp)} gp (เหรียญ 50 เหรียญ = 1 lb) · เกิน STR×5 / ×10 ใช้กฎเสริมเรื่องความหนัก`;
  const f = $('#loadFill');
  const pct = clamp((w / cap) * 100, 0, 100);
  f.style.width = pct + '%';
  f.className = w > c.scores.str * 10 || w > cap ? 'low' : w > c.scores.str * 5 ? 'mid' : '';
}

function renderSheet() {
  const c = cur();
  const rs = $('#f-race');
  $$('option[data-legacy]', rs).forEach(o => o.remove());
  if (c.race && !SPECIES[c.race]) rs.append(h('option', { value: c.race, text: c.race, 'data-legacy': '1' }));
  const bs = $('#f-bg');
  $$('option[data-legacy]', bs).forEach(o => o.remove());
  if (c.background && !BACKGROUNDS[c.background]) bs.append(h('option', { value: c.background, text: c.background, 'data-legacy': '1' }));
  $$('[data-f]').forEach(el => {
    const k = el.dataset.f;
    el.value = k === 'hp' ? (c.hp ?? maxHp(c)) : (c[k] ?? '');
  });
  ABILITIES.forEach(a => {
    $(`[data-ab="${a.k}"]`).value = c.scores[a.k];
    $(`[data-save="${a.k}"]`).checked = !!c.saves[a.k];
  });
  $('#charSelect').value = activeId;
  fillAsiRef();
  $('#f-shield').checked = !!c.shield;
  const bgd = BACKGROUNDS[c.background];
  const bonusTxt = Object.entries(c.raceBonus || {}).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(' ');
  $('#raceHint').textContent = bgd ? `ภูมิหลัง: ${bonusTxt} (รวมในค่าสถานะแล้ว) · ชำนาญ ${bgd.sk.map(k => SKILLS.find(s => s.k === k).th).join(', ')} · เครื่องมือ ${bgd.tool} · Feat ${bgd.feat}` : '';
  renderAttacks();
  renderFeats();
  renderSpells();
  renderInventory();
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
  refreshSpellStats();
  refreshLoad();
  refreshArmorSkills();
  $('#init').textContent = fmt(initBonus(c));
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

// สถานะ (Condition) ตามกฎ 2024 + Concentrating
const CONDS = [
  ['blinded', '🙈', 'Blinded'], ['charmed', '💘', 'Charmed'], ['deafened', '🔇', 'Deafened'], ['exhaustion', '😴', 'Exhaustion'],
  ['frightened', '😱', 'Frightened'], ['grappled', '🤼', 'Grappled'], ['incapacitated', '🚫', 'Incapacitated'], ['invisible', '👻', 'Invisible'],
  ['paralyzed', '⚡', 'Paralyzed'], ['petrified', '🗿', 'Petrified'], ['poisoned', '☠️', 'Poisoned'], ['prone', '🛌', 'Prone'],
  ['restrained', '🔗', 'Restrained'], ['stunned', '💫', 'Stunned'], ['unconscious', '💤', 'Unconscious'], ['concentrating', '🧠', 'Concentrating'],
];
const condInfo = k => CONDS.find(c => c[0] === k);
const DRAW_TYPES = ['pen', 'text', 'circle', 'cone', 'line', 'cube'];

// ฉาก: 'main' = ฉากหลัก (เก็บที่เดิมเพื่อให้ห้องเก่ายังใช้ได้) ฉากอื่นเก็บใต้ sdata/<id>/
let scene = 'main';
let scenes = store.get('scenes', {}); // ออฟไลน์: id -> { name, ts }
{ const sv = store.get('scene', 'main'); scene = sv === 'main' || scenes[sv] ? sv : 'main'; }
const sp = name => (scene === 'main' ? name : `sdata/${scene}/${name}`);
const sref = name => roomRef(sp(name));
const lk = name => (scene === 'main' ? name : `${name}@${scene}`);
const sceneName = id => (id === 'main' ? 'ฉากหลัก' : String((online() ? room.scenes : scenes)[id]?.name || 'ฉาก'));

let tokens = loadLocalTokens();
let selected = null;
let maps = loadLocalMaps();
let selectedMap = null;
let draws = loadLocalDraws();
const imgs = {}; // id -> HTMLImageElement ที่โหลดเสร็จแล้ว
const tokImgs = {}; // id -> รูปโทเคน
let bgUrl = store.get('bg', '');
let bgImg = null;
let fog = store.get(lk('fog'), ''); // สตริงยาว 1600 ตัว '1' = ช่องที่ถูกหมอกปิด (ว่าง = ไม่ใช้หมอก)
if (typeof fog !== 'string' || (fog && fog.length !== GRID * GRID)) fog = '';
let fogMode = 'reveal', fogBrush = 1, fogLast = null, fogDirty = false;
const fogHidden = (x, y) => fog.length === GRID * GRID && fog[y * GRID + x] === '1';
const view = { s: 1, x: 0, y: 0 };
let W = 0;
let H = 0;
let dpr = 1;
let fitted = false;
let drag = null;
let pan = null;
let pinch = null;
const ptrs = new Map();

// เครื่องมือบนกระดาน
let tool = 'move'; // move | ruler | pen | text | tpl | erase | ping | fog
let drawColor = COLORS[1];
let tplKind = 'circle';
let tplSize = 20;
let tdrag = null; // การลากของเครื่องมือที่กำลังทำอยู่
let draft = null; // เส้น/เทมเพลตที่กำลังวาด (ยังไม่บันทึก)
let ruler = null;
let remoteRulers = {};
let pings = [];
let initState = loadLocalInit();

const cv = $('#board');
const ctx = cv.getContext('2d');

function normToken(t, id) {
  const size = clamp(Math.round(Number(t?.size)) || 1, 1, 4);
  const iv = (v, a, b) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : clamp(Math.round(Number(v)), a, b));
  const cs = (Array.isArray(t?.conds) ? t.conds : String(t?.conds || '').split(',')).filter(k => condInfo(k));
  return {
    id,
    name: String(t?.name ?? '').slice(0, 40),
    size,
    color: safeColor(t?.color),
    owner: String(t?.owner ?? ''),
    x: clamp(Math.round(Number(t?.x)) || 0, 0, GRID - size),
    y: clamp(Math.round(Number(t?.y)) || 0, 0, GRID - size),
    hpMax: iv(t?.hpMax, 0, 9999),
    hp: iv(t?.hp, -999, 9999),
    conds: [...new Set(cs)],
    hidden: !!t?.hidden,
    locked: !!t?.locked,
    cid: String(t?.cid ?? '').slice(0, 12),
    img: !!t?.img,
    imgSrc: typeof t?.imgSrc === 'string' && t.imgSrc.startsWith('data:image/') ? t.imgSrc : undefined,
  };
}
function loadLocalTokens() {
  const raw = store.get(lk('tokens'), {});
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normToken(v, k)]));
}
const canEdit = t => iAmDM() || (t.owner === myId() && !t.locked);
// DM เห็นแถบ HP ทุกตัว ผู้เล่นเห็นเฉพาะของพวกพ้อง (โทเคนที่ไม่ใช่ของ DM)
const showHp = t => !online() || iAmDM() || t.owner === myId() || t.owner !== room.dm;
const tokenVisible = t => iAmDM() || (!t.hidden && !fogHidden(t.x, t.y));
const visTokens = () => Object.values(tokens).filter(tokenVisible);

/* --- เส้นวาด / ข้อความ / เทมเพลต --- */
function normDraw(d, id) {
  const num = (v, a, b, def) => clamp(Number.isFinite(Number(v)) ? Number(v) : def, a, b);
  const o = {
    id,
    t: DRAW_TYPES.includes(d?.t) ? d.t : 'pen',
    c: safeColor(d?.c),
    o: String(d?.o ?? ''),
    ts: Number(d?.ts) || 0,
    x: num(d?.x, -5, GRID + 5, 0),
    y: num(d?.y, -5, GRID + 5, 0),
    r: num(d?.r, 1, 600, 20),
    a: num(d?.a, -7, 7, 0),
    s: String(d?.s ?? '').slice(0, 80),
    p: typeof d?.p === 'string' ? d.p.slice(0, 6000) : '',
  };
  o.pts = o.p ? o.p.split(';').flatMap(q => q.split(',').map(Number)).filter(Number.isFinite) : [];
  return o;
}
function loadLocalDraws() {
  const raw = store.get(lk('draw'), {});
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normDraw(v, k)]));
}
const drawList = () => Object.values(draws).sort((a, b) => a.ts - b.ts);
const canDelDraw = d => iAmDM() || d.o === myId();

/* --- อินิเชียทีฟ --- */
function normInit(v) {
  const entries = {};
  Object.entries(v?.entries || {}).forEach(([k, e]) => {
    if (!e || typeof e !== 'object') return;
    entries[k] = {
      id: k,
      name: String(e.name || '?').slice(0, 40),
      val: e.val == null || !Number.isFinite(Number(e.val)) ? null : Math.round(Number(e.val)),
      tid: String(e.tid || ''),
      owner: String(e.owner || ''),
      ord: Number(e.ord) || 0,
    };
  });
  return { entries, turn: String(v?.turn || ''), round: clamp(Math.round(Number(v?.round)) || 1, 1, 999) };
}
function loadLocalInit() { return normInit(store.get('init', {})); }

/* =====================================================================
   รูปบนกระดาน (แผนที่ / ภาพประกอบ) — ผู้เล่นแทรกเองจากเครื่องได้
   - ย่อรูปในเบราว์เซอร์ก่อน แล้วเก็บเป็น data URL
   - ออนไลน์: เก็บขนาด/ตำแหน่งที่ rooms/<code>/maps และตัวรูปที่ rooms/<code>/mapimg
     (แยกกัน เพื่อไม่ให้ทุกครั้งที่ลากต้องส่งรูปซ้ำ)
   ===================================================================== */
const round2 = v => Math.round(v * 2) / 2;
const MAX_IMG_CHARS = 700000;

function normMap(m, id) {
  const num = (v, a, b, d) => clamp(Number.isFinite(Number(v)) ? Number(v) : d, a, b);
  return {
    id,
    name: String(m?.name ?? '').slice(0, 40),
    x: num(m?.x, -50, 100, 0),
    y: num(m?.y, -50, 100, 0),
    w: num(m?.w, 0.5, 100, 10),
    h: num(m?.h, 0.5, 100, 10),
    owner: String(m?.owner ?? ''),
    created: Number(m?.created) || 0,
    src: typeof m?.src === 'string' && m.src.startsWith('data:image/') ? m.src : undefined,
  };
}
function loadLocalMaps() {
  const raw = store.get(lk('maps'), {});
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, normMap(v, k)]));
}
const canEditMap = m => iAmDM() || m.owner === myId();
const sortedMaps = () => Object.values(maps).sort((a, b) => a.created - b.created);

function loadImg(id, src) {
  if (typeof src !== 'string' || !src.startsWith('data:image/')) return;
  const im = new Image();
  im.onload = () => { imgs[id] = im; draw(); };
  im.src = src;
}
function rebuildLocalImgs() {
  Object.keys(imgs).forEach(k => delete imgs[k]);
  Object.values(maps).forEach(m => loadImg(m.id, m.src));
}
function saveLocalMaps() {
  if (online()) return;
  if (!store.set(lk('maps'), maps)) toast('พื้นที่เก็บในเบราว์เซอร์เต็ม — ลบรูปเก่าบางรูปก่อน');
}

function hitMap(px, py) {
  const w = toWorld(px, py);
  const cx = w.x / CELL;
  const cy = w.y / CELL;
  return sortedMaps().reverse().find(m => cx >= m.x && cx < m.x + m.w && cy >= m.y && cy < m.y + m.h) || null;
}
function hitHandle(px, py) {
  const m = maps[selectedMap];
  if (!m || !canEditMap(m)) return false;
  const hx = view.x + (m.x + m.w) * CELL * view.s;
  const hy = view.y + (m.y + m.h) * CELL * view.s;
  return Math.hypot(px - hx, py - hy) <= 22;
}

async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file); } catch { /* ลองวิธีสำรอง */ }
  }
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); res(im); };
    im.onerror = rej;
    im.src = u;
  });
}

// ย่อด้านยาวสุดไม่เกิน 1600px และบีบจนไม่เกิน ~700KB (ลองซ้ำโดยลดขนาด/คุณภาพ)
async function compressImage(file) {
  const bmp = await loadBitmap(file);
  const bw = bmp.width || bmp.naturalWidth;
  const bh = bmp.height || bmp.naturalHeight;
  let maxSide = 1600;
  let q = 0.8;
  for (let i = 0; i < 7; i++) {
    const k = Math.min(1, maxSide / Math.max(bw, bh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bw * k));
    c.height = Math.max(1, Math.round(bh * k));
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0, c.width, c.height);
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) { // เบราว์เซอร์ไม่รองรับ webp → ใช้ jpeg พื้นขาว
      g.globalCompositeOperation = 'destination-over';
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      url = c.toDataURL('image/jpeg', q);
    }
    if (url.length <= MAX_IMG_CHARS) return { src: url, w: bw, h: bh };
    maxSide = Math.round(maxSide * 0.8);
    q = Math.max(0.45, q - 0.08);
  }
  throw new Error('too big');
}

async function addMapFromFile(file) {
  if (!file || !file.type.startsWith('image/')) { toast('เลือกไฟล์รูปภาพเท่านั้น'); return; }
  toast('กำลังย่อรูป...', 8000);
  let img;
  try { img = await compressImage(file); } catch { toast('อ่านหรือย่อรูปนี้ไม่ได้'); return; }

  const first = !Object.keys(maps).length; // รูปแรก = แผนที่หลัก เต็มกริด
  const k = (first ? GRID : 14) / Math.max(img.w, img.h);
  const w = Math.max(1, round2(img.w * k));
  const h = Math.max(1, round2(img.h * k));
  let x = 0;
  let y = 0;
  if (!first) {
    const c = toWorld(W / 2, H / 2);
    x = round2(clamp(c.x / CELL - w / 2, 0, GRID - 1));
    y = round2(clamp(c.y / CELL - h / 2, 0, GRID - 1));
  }
  const id = uid8();
  const m = {
    id, x, y, w, h, owner: myId(), created: Date.now(),
    name: (file.name || '').replace(/\.[^.]+$/, '').slice(0, 40) || 'แผนที่',
  };
  if (online()) {
    try {
      await fb.D.set(sref(`maps/${id}`), { name: m.name, x, y, w, h, owner: m.owner, created: m.created });
      await fb.D.set(sref(`mapimg/${id}`), img.src);
    } catch {
      toast('ส่งรูปเข้าห้องไม่สำเร็จ (เน็ตหลุดหรือไม่มีสิทธิ์)');
      try { await fb.D.remove(sref(`maps/${id}`)); } catch { /* ignore */ }
      return;
    }
  } else {
    m.src = img.src;
    maps[id] = m;
    loadImg(id, img.src);
    saveLocalMaps();
    renderMapList();
    draw();
  }
  selectMap(id);
  toast('วางรูปแล้ว — ลากเพื่อย้าย · ลากวงกลมมุมขวาล่างเพื่อปรับขนาด', 4500);
}

async function mapDelete(id) {
  if (online()) {
    try {
      await fb.D.remove(sref(`mapimg/${id}`)); // ลบรูปก่อน (กฎตรวจเจ้าของจากข้อมูล maps)
      await fb.D.remove(sref(`maps/${id}`));
    } catch { toast('ลบไม่สำเร็จ (ไม่มีสิทธิ์)'); }
  } else {
    delete maps[id];
    delete imgs[id];
    if (selectedMap === id) selectedMap = null;
    saveLocalMaps();
    renderMapList(); updateSelBar(); draw();
  }
}

// ใช้หลังลากย้าย/ปรับขนาดเสร็จ (ค่าใน maps ถูกแก้ไว้แล้วระหว่างลาก)
async function commitMap(d) {
  const m = maps[d.id];
  if (!m) return;
  if (!online()) { saveLocalMaps(); draw(); return; }
  const patch = d.kind === 'map' ? { x: m.x, y: m.y } : { w: m.w, h: m.h };
  try {
    await fb.D.update(sref(`maps/${m.id}`), patch);
  } catch {
    if (d.kind === 'map') { m.x = d.ox; m.y = d.oy; } else { m.w = d.ow; m.h = d.oh; }
    draw();
    toast('ปรับรูปไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)');
  }
}

// แก้หลายค่าพร้อมกัน เช่น ปุ่ม "เต็มกริด"
async function patchMap(m, patch) {
  const old = { x: m.x, y: m.y, w: m.w, h: m.h };
  Object.assign(m, patch);
  draw();
  if (!online()) { saveLocalMaps(); return; }
  try {
    await fb.D.update(sref(`maps/${m.id}`), patch);
  } catch {
    Object.assign(m, old);
    draw();
    toast('ไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)');
  }
}

function renderMapList() {
  const box = $('#mapList');
  box.innerHTML = '';
  const arr = sortedMaps();
  if (!arr.length) {
    box.append(h('div', { class: 'muted small', text: 'ยังไม่มีรูป — กด "🖼 รูป" เพื่อเพิ่มแผนที่จากเครื่อง' }));
    return;
  }
  arr.forEach(m => {
    box.append(h('button', { class: 'tok-row' + (m.id === selectedMap ? ' sel' : ''), onclick: () => { selectMap(m.id); centerRect(m.x, m.y, m.w, m.h); } },
      h('span', { text: '🖼 ' + (m.name || 'รูป') }),
      h('small', { class: 'muted', text: `${m.w}×${m.h}` })));
  });
}

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
  return visTokens().sort((a, b) => (smallFirst ? a.size - b.size : b.size - a.size));
}
function hitToken(px, py) {
  const w = toWorld(px, py);
  const cx = w.x / CELL;
  const cy = w.y / CELL;
  return sortedTokens(true).find(t => cx >= t.x && cx < t.x + t.size && cy >= t.y && cy < t.y + t.size) || null;
}

/* --- วาดเส้น / ข้อความ / เทมเพลต --- */
function tplShape(d) {
  const L = d.r / 5;
  const ca = Math.cos(d.a), sa = Math.sin(d.a);
  if (d.t === 'circle') return { circle: true, x: d.x, y: d.y, r: L };
  if (d.t === 'cube') return { poly: [[d.x - L / 2, d.y - L / 2], [d.x + L / 2, d.y - L / 2], [d.x + L / 2, d.y + L / 2], [d.x - L / 2, d.y + L / 2]] };
  const ex = d.x + L * ca, ey = d.y + L * sa;
  if (d.t === 'cone') { // กรวยตามกฎ: กว้างที่ปลาย = ยาว
    const px = -sa * L / 2, py = ca * L / 2;
    return { poly: [[d.x, d.y], [ex + px, ey + py], [ex - px, ey - py]] };
  }
  const px = -sa * 0.5, py = ca * 0.5; // เส้น: กว้าง 5 ft
  return { poly: [[d.x + px, d.y + py], [ex + px, ey + py], [ex - px, ey - py], [d.x - px, d.y - py]] };
}
function inTemplate(d, cx, cy) {
  const g = tplShape(d);
  if (g.circle) return Math.hypot(cx - g.x, cy - g.y) <= g.r;
  let inside = false;
  const p = g.poly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i][1] > cy) !== (p[j][1] > cy) && cx < ((p[j][0] - p[i][0]) * (cy - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
  }
  return inside;
}
function drawTemplate(d) {
  const g = tplShape(d);
  ctx.beginPath();
  let lx, ly;
  if (g.circle) {
    ctx.arc(g.x * CELL, g.y * CELL, g.r * CELL, 0, Math.PI * 2);
    lx = g.x; ly = g.y;
  } else {
    g.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * CELL, y * CELL) : ctx.moveTo(x * CELL, y * CELL)));
    ctx.closePath();
    lx = g.poly.reduce((a, q) => a + q[0], 0) / g.poly.length;
    ly = g.poly.reduce((a, q) => a + q[1], 0) / g.poly.length;
  }
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = d.c; ctx.fill(); ctx.restore();
  ctx.lineWidth = 2.5 / view.s; ctx.strokeStyle = d.c; ctx.stroke();
  ctx.font = `700 ${12 / view.s}px Sarabun, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3 / view.s; ctx.strokeStyle = 'rgba(0,0,0,.8)';
  ctx.strokeText(`${d.r} ft`, lx * CELL, ly * CELL);
  ctx.fillStyle = '#fff'; ctx.fillText(`${d.r} ft`, lx * CELL, ly * CELL);
}
function drawPen(d) {
  const p = d.pts;
  if (p.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(p[0] * CELL, p[1] * CELL);
  for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * CELL, p[i + 1] * CELL);
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = d.c; ctx.stroke();
  ctx.lineCap = 'butt';
}
function drawText(d) {
  ctx.font = `700 ${CELL * 0.4}px Sarabun, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(d.s, d.x * CELL, d.y * CELL);
  ctx.fillStyle = d.c; ctx.fillText(d.s, d.x * CELL, d.y * CELL);
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function hitDrawAt(cx, cy) {
  const list = drawList().reverse();
  for (const d of list) {
    if (!canDelDraw(d)) continue;
    if (d.t === 'pen') {
      for (let i = 0; i + 3 < d.pts.length; i += 2) if (segDist(cx, cy, d.pts[i], d.pts[i + 1], d.pts[i + 2], d.pts[i + 3]) < 0.35) return d;
      if (d.pts.length === 2 && Math.hypot(cx - d.pts[0], cy - d.pts[1]) < 0.35) return d;
    } else if (d.t === 'text') {
      if (Math.abs(cx - d.x) <= Math.max(0.5, d.s.length * 0.22) && Math.abs(cy - d.y) <= 0.35) return d;
    } else if (inTemplate(d, cx, cy)) return d;
  }
  return null;
}

function drawRuler(r, color, who) {
  const a = { x: r.ax ?? r.a?.x, y: r.ay ?? r.a?.y };
  const b = { x: r.bx ?? r.b?.x, y: r.by ?? r.b?.y };
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return;
  ctx.beginPath(); ctx.moveTo(a.x * CELL, a.y * CELL); ctx.lineTo(b.x * CELL, b.y * CELL);
  ctx.lineWidth = 3 / view.s; ctx.strokeStyle = color; ctx.setLineDash([8 / view.s, 5 / view.s]); ctx.stroke(); ctx.setLineDash([]);
  [a, b].forEach(q => { ctx.beginPath(); ctx.arc(q.x * CELL, q.y * CELL, 5 / view.s, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); });
  const ft = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 5;
  const label = `${who ? who + ' · ' : ''}${ft} ft`, fs = 14 / view.s;
  ctx.font = `700 ${fs}px Sarabun, sans-serif`;
  const tw = ctx.measureText(label).width, lx = (a.x + b.x) / 2 * CELL, ly = (a.y + b.y) / 2 * CELL - 8 / view.s;
  ctx.fillStyle = 'rgba(0,0,0,.85)';
  ctx.fillRect(lx - tw / 2 - 5 / view.s, ly - fs - 4 / view.s, tw + 10 / view.s, fs + 8 / view.s);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(label, lx, ly);
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
  sortedMaps().forEach(m => {
    const im = imgs[m.id];
    if (im) {
      ctx.drawImage(im, m.x * CELL, m.y * CELL, m.w * CELL, m.h * CELL);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(m.x * CELL, m.y * CELL, m.w * CELL, m.h * CELL);
    }
  });

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

  // กรอบรูปที่เลือก + จุดจับปรับขนาด
  const sm = maps[selectedMap];
  if (sm) {
    ctx.lineWidth = 3 / view.s;
    ctx.strokeStyle = '#ffd86b';
    ctx.setLineDash([10 / view.s, 6 / view.s]);
    ctx.strokeRect(sm.x * CELL, sm.y * CELL, sm.w * CELL, sm.h * CELL);
    ctx.setLineDash([]);
    if (canEditMap(sm)) {
      ctx.beginPath();
      ctx.arc((sm.x + sm.w) * CELL, (sm.y + sm.h) * CELL, 12 / view.s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd86b';
      ctx.fill();
      ctx.lineWidth = 2 / view.s;
      ctx.strokeStyle = '#1a1405';
      ctx.stroke();
    }
  }

  // เส้นวาด (ชั้นล่างโทเคน)
  const dl = drawList();
  dl.forEach(d => { if (d.t === 'pen') drawPen(d); });
  if (draft?.t === 'pen') drawPen(draft);

  // โทเคน (ใหญ่ก่อน เล็กอยู่บน)
  const curTid = initState.entries[initState.turn]?.tid || '';
  sortedTokens(false).forEach(t => {
    const cx = (t.x + t.size / 2) * CELL;
    const cy = (t.y + t.size / 2) * CELL;
    const r = (t.size * CELL) / 2 - 3;
    ctx.save();
    if (t.hidden) ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = safeColor(t.color);
    ctx.fill();
    const im = tokImgs[t.id];
    if (im) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(im, cx - r, cy - r, 2 * r, 2 * r);
      ctx.restore();
    }
    if (t.id === curTid) { // ตาของโทเคนนี้ (อินิเชียทีฟ)
      ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
      ctx.lineWidth = 4 / view.s; ctx.strokeStyle = '#7dff9b'; ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = (t.id === selected ? 4 : 2) / view.s;
    ctx.strokeStyle = t.id === selected ? '#ffd86b' : (t.hidden ? '#9be' : 'rgba(255,255,255,.75)');
    if (t.hidden) ctx.setLineDash([6 / view.s, 4 / view.s]);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!im) {
      ctx.fillStyle = '#10131a';
      ctx.font = `700 ${r * 0.95}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(([...t.name][0] || '?').toUpperCase(), cx, cy + r * 0.05);
    }

    if (t.hpMax && showHp(t)) {
      const hp = t.hp ?? t.hpMax;
      const pct = clamp(hp / t.hpMax, 0, 1);
      if (hp <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.font = `${r * 1.1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff'; ctx.fillText('💀', cx, cy);
      }
      const bw = t.size * CELL - 12, bx = t.x * CELL + 6, by = (t.y + t.size) * CELL - 12;
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, 9);
      ctx.fillStyle = pct <= 0.25 ? '#e5534b' : pct <= 0.6 ? '#e0b457' : '#5cb85c';
      ctx.fillRect(bx, by, bw * pct, 6);
    }

    // ป้ายสถานะ
    const cl = t.conds.slice(0, 4);
    cl.forEach((k, i) => {
      const bx = t.x * CELL + 10 + i * 18, by = t.y * CELL + 10;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fill();
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
      ctx.fillText(condInfo(k)[1], bx, by + 1);
    });
    if (t.conds.length > 4) {
      ctx.font = '700 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.fillText(`+${t.conds.length - 4}`, t.x * CELL + 10 + 4 * 18 - 6, t.y * CELL + 11);
    }
    if (t.locked) {
      ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
      ctx.fillText('🔒', (t.x + t.size) * CELL - 3, t.y * CELL + 3);
    }
    ctx.restore();

    if (view.s >= 0.5) {
      ctx.save();
      if (t.hidden) ctx.globalAlpha = 0.6;
      ctx.font = `600 ${12 / view.s}px Sarabun, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3 / view.s;
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(t.name, cx, (t.y + t.size) * CELL + 1 / view.s);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.name, cx, (t.y + t.size) * CELL + 1 / view.s);
      ctx.restore();
    }
  });

  // เทมเพลต + ข้อความ (ชั้นบนโทเคน)
  dl.forEach(d => { if (d.t === 'text') drawText(d); else if (d.t !== 'pen') drawTemplate(d); });
  if (draft && draft.t !== 'pen') drawTemplate(draft);

  // หมอก (DM เห็นเป็นโปร่ง ผู้เล่นทึบ)
  if (fog.length === GRID * GRID) {
    ctx.fillStyle = iAmDM() ? 'rgba(6,8,14,.55)' : '#06080e';
    const e = 0.6;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      if (fog[j * GRID + i] === '1') ctx.fillRect(i * CELL - e, j * CELL - e, CELL + 2 * e, CELL + 2 * e);
    }
  }

  // ระยะที่ลากอยู่
  if (drag && drag.kind === 'token' && drag.moved && tokens[drag.id]) {
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

  // ไม้บรรทัด (ของตัวเอง + ของคนอื่นในห้อง)
  Object.values(remoteRulers).forEach(r => drawRuler(r, safeColor(r.c), String(r.n || '').slice(0, 20)));
  if (ruler) drawRuler(ruler, '#ffd86b', '');

  // Ping
  const now = performance.now();
  pings.forEach(p => {
    const age = (now - p.t0) / 1800;
    if (age >= 1) return;
    for (let k = 0; k < 3; k++) {
      const a = clamp(age - k * 0.15, 0, 1);
      if (a <= 0) continue;
      ctx.beginPath(); ctx.arc(p.x * CELL, p.y * CELL, CELL * (0.2 + a * 1.8), 0, Math.PI * 2);
      ctx.lineWidth = 4 / view.s; ctx.strokeStyle = p.c; ctx.globalAlpha = 1 - a; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (p.n) {
      ctx.font = `700 ${13 / view.s}px Sarabun, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3 / view.s; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(p.n, p.x * CELL, p.y * CELL - CELL * 0.4);
      ctx.fillStyle = p.c; ctx.fillText(p.n, p.x * CELL, p.y * CELL - CELL * 0.4);
    }
  });

  $('#zoomLbl').textContent = (sceneEntries().length > 1 ? sceneName(scene) + ' · ' : '') + Math.round(view.s * 100) + '%';
}
let pingRaf = 0;
function addPing(p) {
  pings.push({ x: Number(p.x), y: Number(p.y), c: safeColor(p.c), n: String(p.n || '').slice(0, 20), t0: performance.now() });
  if (pingRaf) return;
  const step = () => {
    const now = performance.now();
    pings = pings.filter(q => now - q.t0 < 1800);
    draw();
    pingRaf = pings.length ? requestAnimationFrame(step) : 0;
  };
  pingRaf = requestAnimationFrame(step);
}

function loadBg() {
  if (!bgUrl) { bgImg = null; draw(); return; }
  const img = new Image();
  img.onload = () => { bgImg = img; draw(); };
  img.onerror = () => { bgImg = null; toast('โหลดรูปพื้นหลังไม่ได้'); draw(); };
  img.src = bgUrl;
}

/* --- หมอก (เฉพาะ DM) --- */
function fogCell(ox, oy) {
  const w = toWorld(ox, oy);
  return { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) };
}
function fogPaint(c) {
  if (c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID) return;
  if (fog.length !== GRID * GRID) fog = '0'.repeat(GRID * GRID);
  const a = fog.split('');
  const v = fogMode === 'hide' ? '1' : '0';
  const r = (fogBrush - 1) / 2;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (x >= 0 && y >= 0 && x < GRID && y < GRID) a[y * GRID + x] = v;
  }
  fog = a.join('');
  fogDirty = true;
}
function fogStroke(to) {
  const from = fogLast || to;
  const n = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y), 1);
  for (let i = 1; i <= n; i++) fogPaint({ x: Math.round(from.x + (to.x - from.x) * i / n), y: Math.round(from.y + (to.y - from.y) * i / n) });
  fogLast = to;
  draw();
}
async function fogSave() {
  fogDirty = false;
  if (online()) {
    try {
      if (fog.length === GRID * GRID) await fb.D.set(sref('fog'), fog); else await fb.D.remove(sref('fog'));
    } catch { toast('บันทึกหมอกไม่สำเร็จ (เฉพาะ DM)'); }
  } else store.set(lk('fog'), fog);
}
function fogStop() { if (tool === 'fog') setTool('move'); }
function fogUI() {
  $('#fogReveal').classList.toggle('on', fogMode === 'reveal');
  $('#fogHide').classList.toggle('on', fogMode === 'hide');
  $('#fogBrush').textContent = 'พู่กัน ' + fogBrush;
}

/* --- เครื่องมือบนกระดาน --- */
function setTool(name) {
  if (name === 'fog' && !iAmDM()) name = 'move';
  tool = name;
  ruler = null; draft = null; tdrag = null; fogLast = null;
  $$('#toolbar2 button').forEach(b => b.classList.toggle('on', b.dataset.tool === name));
  $('#fogBar').hidden = name !== 'fog';
  if (name === 'fog') { fogUI(); toast('ลากบนกระดานเพื่อเปิด/ซ่อนช่อง', 2500); }
  cv.style.cursor = name === 'move' ? '' : 'crosshair';
  buildToolOpts();
  draw();
}

function swatchRow() {
  return h('span', { class: 'swatches' }, ...COLORS.map(c => h('button', {
    type: 'button', class: 'sw' + (c === drawColor ? ' on' : ''), style: `background:${c}`, 'aria-label': c,
    onclick: () => { drawColor = c; buildToolOpts(); },
  })));
}
function buildToolOpts() {
  const box = $('#toolOpts');
  box.innerHTML = '';
  const show = ['pen', 'text', 'tpl', 'erase'].includes(tool);
  box.hidden = !show;
  if (!show) return;
  if (tool === 'pen') {
    box.append(h('b', { text: '✏️' }), swatchRow(), h('button', { text: 'ลบเส้นของฉัน', onclick: () => clearMyDraws(['pen']) }));
  } else if (tool === 'text') {
    box.append(h('b', { text: '🔤' }), swatchRow(), h('span', { class: 'muted small', text: 'แตะบนกระดานเพื่อวางข้อความ' }));
  } else if (tool === 'tpl') {
    const shape = h('select', { 'aria-label': 'รูปทรง', onchange: e => { tplKind = e.target.value; } },
      ...[['circle', 'วงกลม (Sphere)'], ['cone', 'กรวย (Cone)'], ['line', 'เส้น (Line 5ft)'], ['cube', 'สี่เหลี่ยม (Cube)']]
        .map(([v, l]) => h('option', { value: v, text: l, selected: v === tplKind })));
    const sz = h('select', { 'aria-label': 'ขนาด', onchange: e => { tplSize = Number(e.target.value); } },
      ...[5, 10, 15, 20, 30, 40, 60, 90, 120].map(n => h('option', { value: n, text: `${n} ft`, selected: n === tplSize })));
    box.append(shape, sz, swatchRow(), h('button', { text: 'ลบของฉัน', onclick: () => clearMyDraws(['circle', 'cone', 'line', 'cube']) }));
  } else if (tool === 'erase') {
    box.append(h('b', { text: '🧽' }), h('span', { class: 'muted small', text: 'แตะหรือลากทับเส้น/ข้อความ/เทมเพลต' }),
      h('button', { class: 'danger', text: iAmDM() ? 'ลบทั้งหมด' : 'ลบของฉันทั้งหมด', onclick: () => clearMyDraws(DRAW_TYPES) }));
  }
}

function rulerPt(ox, oy) {
  const w = toWorld(ox, oy);
  return { x: clamp(Math.round(w.x / CELL), 0, GRID), y: clamp(Math.round(w.y / CELL), 0, GRID) };
}
let lastRulerSend = 0;
let rulerTimer = 0;
function shareRuler(final) {
  if (!online() || !ruler) return;
  const now = Date.now();
  if (!final && now - lastRulerSend < 120) return;
  lastRulerSend = now;
  fb.D.set(roomRef(`rulers/${room.uid}`), {
    ax: ruler.a.x, ay: ruler.a.y, bx: ruler.b.x, by: ruler.b.y, c: drawColor, n: room.name || '?', ts: now,
  }).catch(() => {});
  if (final) {
    clearTimeout(rulerTimer);
    rulerTimer = setTimeout(() => { if (online()) fb.D.remove(roomRef(`rulers/${room.uid}`)).catch(() => {}); }, 6000);
  }
}

const r2 = v => Math.round(v * 100) / 100;
const snap5 = v => Math.round(v * 2) / 2;
const snapAngle = a => Math.round(a / (Math.PI / 12)) * (Math.PI / 12);

function toolDown(e) {
  const px = e.offsetX, py = e.offsetY;
  const w = toWorld(px, py);
  const cx = w.x / CELL, cy = w.y / CELL;
  if (tool === 'fog') { fogLast = null; fogStroke(fogCell(px, py)); tdrag = { k: 'fog' }; return; }
  if (tool === 'ruler') {
    clearTimeout(rulerTimer);
    const q = rulerPt(px, py);
    ruler = { a: q, b: q };
    tdrag = { k: 'ruler' };
    draw();
    return;
  }
  if (tool === 'pen') {
    tdrag = { k: 'pen', pts: [r2(cx), r2(cy)] };
    draft = { t: 'pen', c: drawColor, pts: tdrag.pts };
    draw();
    return;
  }
  if (tool === 'text') { tdrag = { k: 'text', x: px, y: py, cx: snap5(cx), cy: snap5(cy) }; return; }
  if (tool === 'tpl') {
    tdrag = { k: 'tpl', ox: snap5(cx), oy: snap5(cy), a: 0 };
    draft = { t: tplKind, c: drawColor, r: tplSize, x: tdrag.ox, y: tdrag.oy, a: 0 };
    draw();
    return;
  }
  if (tool === 'erase') { tdrag = { k: 'erase' }; eraseAt(cx, cy); return; }
  if (tool === 'ping') {
    const p = { x: r2(cx), y: r2(cy), c: drawColor, n: room.name || '', from: online() ? room.uid : 'local', ts: Date.now(), k: Math.random() };
    addPing(p);
    if (online()) fb.D.set(roomRef('ping'), p).catch(() => {});
    tdrag = { k: 'ping' };
  }
}

function toolMove(e) {
  if (!tdrag) return;
  const px = e.offsetX, py = e.offsetY;
  const w = toWorld(px, py);
  const cx = w.x / CELL, cy = w.y / CELL;
  if (tdrag.k === 'fog') { fogStroke(fogCell(px, py)); return; }
  if (tdrag.k === 'ruler') { ruler.b = rulerPt(px, py); shareRuler(false); draw(); return; }
  if (tdrag.k === 'pen') {
    const p = tdrag.pts;
    if (p.length < 800 && Math.hypot(cx - p[p.length - 2], cy - p[p.length - 1]) > 0.15) { p.push(r2(cx), r2(cy)); draw(); }
    return;
  }
  if (tdrag.k === 'text') { if (Math.hypot(px - tdrag.x, py - tdrag.y) > 8) { tdrag.cx = snap5(cx); tdrag.cy = snap5(cy); } return; }
  if (tdrag.k === 'tpl') {
    if (tplKind === 'cone' || tplKind === 'line') {
      const dx = cx - tdrag.ox, dy = cy - tdrag.oy;
      if (Math.hypot(dx, dy) > 0.3) draft.a = snapAngle(Math.atan2(dy, dx));
    } else { draft.x = snap5(cx); draft.y = snap5(cy); }
    draw();
    return;
  }
  if (tdrag.k === 'erase') eraseAt(cx, cy);
}

function toolUp() {
  const d = tdrag;
  tdrag = null;
  if (!d) return;
  if (d.k === 'fog') { fogLast = null; if (fogDirty) fogSave(); return; }
  if (d.k === 'ruler') { shareRuler(true); draw(); return; }
  if (d.k === 'pen' && d.pts.length >= 2) {
    const pts = d.pts.length === 2 ? [d.pts[0], d.pts[1], d.pts[0] + 0.01, d.pts[1]] : d.pts;
    const p = [];
    for (let i = 0; i < pts.length; i += 2) p.push(`${pts[i]},${pts[i + 1]}`);
    draft = null;
    drawPut({ t: 'pen', c: drawColor, p: p.join(';') });
    return;
  }
  if (d.k === 'text') {
    const s = (prompt('ข้อความที่จะวางบนกระดาน') || '').trim().slice(0, 80);
    if (s) drawPut({ t: 'text', c: drawColor, x: d.cx, y: d.cy, s });
    return;
  }
  if (d.k === 'tpl' && draft) {
    const t = draft;
    draft = null;
    drawPut({ t: t.t, c: t.c, x: t.x, y: t.y, r: t.r, a: r2(t.a) });
    return;
  }
  draft = null;
  draw();
}

function eraseAt(cx, cy) {
  const d = hitDrawAt(cx, cy);
  if (d) drawDelete(d.id);
}

/* --- จัดการเส้นวาด --- */
function saveLocalDraws() { if (!online()) store.set(lk('draw'), draws); }
async function drawPut(d) {
  const id = uid8();
  const data = { t: d.t, c: d.c, o: myId(), ts: Date.now() };
  ['x', 'y', 'r', 'a', 's', 'p'].forEach(k => { if (d[k] != null) data[k] = d[k]; });
  if (online()) {
    try { await fb.D.set(sref(`draw/${id}`), data); } catch { toast('วาดไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)'); }
  } else {
    draws[id] = normDraw(data, id);
    saveLocalDraws();
    draw();
  }
}
async function drawDelete(id) {
  if (!draws[id]) return;
  if (online()) {
    delete draws[id]; draw();
    try { await fb.D.remove(sref(`draw/${id}`)); } catch { toast('ลบไม่สำเร็จ (ไม่มีสิทธิ์)'); }
  } else {
    delete draws[id];
    saveLocalDraws();
    draw();
  }
}
function clearMyDraws(types) {
  const ids = drawList().filter(d => types.includes(d.t) && canDelDraw(d)).map(d => d.id);
  if (!ids.length) { toast('ไม่มีอะไรให้ลบ'); return; }
  if (iAmDM() && types.length === DRAW_TYPES.length && !confirm(`ลบทั้งหมด ${ids.length} รายการ?`)) return;
  ids.forEach(id => drawDelete(id));
}

/* --- การโต้ตอบ (เมาส์ + ทัช ผ่าน Pointer Events) --- */
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (ptrs.size === 2) {
    drag = null; pan = null; tdrag = null; draft = null;
    const [a, b] = [...ptrs.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    return;
  }
  if (ptrs.size > 2) return;

  if (tool !== 'move') { toolDown(e); return; }

  // 1) จุดจับปรับขนาดของรูปที่เลือกอยู่
  if (hitHandle(e.offsetX, e.offsetY)) {
    const m = maps[selectedMap];
    drag = { kind: 'resize', id: m.id, aspect: m.w / m.h, ow: m.w, oh: m.h, moved: false };
    return;
  }

  // 2) โทเคน
  const hit = hitToken(e.offsetX, e.offsetY);
  if (hit) {
    selectToken(hit.id);
    if (canEdit(hit)) {
      const w = toWorld(e.offsetX, e.offsetY);
      drag = { kind: 'token', id: hit.id, gx: w.x / CELL - hit.x, gy: w.y / CELL - hit.y, sx: hit.x, sy: hit.y, moved: false };
    } else {
      pan = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, moved: false };
    }
    return;
  }

  // 3) รูป: ลากย้ายได้เฉพาะรูปที่เลือกอยู่แล้ว ไม่งั้นเป็นการเลื่อนกระดาน (แตะเฉยๆ = เลือกรูป)
  const mh = hitMap(e.offsetX, e.offsetY);
  if (mh && mh.id === selectedMap && canEditMap(mh)) {
    const w = toWorld(e.offsetX, e.offsetY);
    drag = { kind: 'map', id: mh.id, gx: w.x / CELL - mh.x, gy: w.y / CELL - mh.y, ox: mh.x, oy: mh.y, moved: false };
  } else {
    pan = { x: e.offsetX, y: e.offsetY, vx: view.x, vy: view.y, moved: false, tapMap: mh ? mh.id : null };
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
  if (tool !== 'move') { if (ptrs.size === 1) toolMove(e); return; }
  if (drag) {
    const w = toWorld(e.offsetX, e.offsetY);
    if (drag.kind === 'token') {
      const t = tokens[drag.id];
      if (!t) return;
      const nx = clamp(Math.round(w.x / CELL - drag.gx), 0, GRID - t.size);
      const ny = clamp(Math.round(w.y / CELL - drag.gy), 0, GRID - t.size);
      if (nx !== t.x || ny !== t.y) { t.x = nx; t.y = ny; drag.moved = true; draw(); }
    } else {
      const m = maps[drag.id];
      if (!m) return;
      if (drag.kind === 'map') {
        const nx = clamp(round2(w.x / CELL - drag.gx), -(m.w - 1), GRID - 1);
        const ny = clamp(round2(w.y / CELL - drag.gy), -(m.h - 1), GRID - 1);
        if (nx !== m.x || ny !== m.y) { m.x = nx; m.y = ny; drag.moved = true; draw(); }
      } else {
        const nw = clamp(round2(w.x / CELL - m.x), 1, 100);
        const nh = Math.max(1, round2(nw / drag.aspect));
        if (nw !== m.w || nh !== m.h) { m.w = nw; m.h = nh; drag.moved = true; draw(); }
      }
    }
  } else if (pan) {
    if (!pan.moved && Math.hypot(e.offsetX - pan.x, e.offsetY - pan.y) > 5) pan.moved = true;
    if (pan.moved) {
      view.x = pan.vx + (e.offsetX - pan.x);
      view.y = pan.vy + (e.offsetY - pan.y);
      draw();
    }
  }
});

function endPointer(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (ptrs.size === 0) {
    if (tool !== 'move') { toolUp(); return; }
    if (drag) {
      const d = drag;
      drag = null;
      if (!d.moved) draw();
      else if (d.kind === 'token' && tokens[d.id]) commitMove(d);
      else if (d.kind !== 'token' && maps[d.id]) commitMap(d);
      else draw();
    }
    if (pan && !pan.moved && 'tapMap' in pan) { // แตะเฉยๆ: เลือกรูป หรือยกเลิกการเลือก
      if (pan.tapMap) selectMap(pan.tapMap);
      else clearSelection();
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
  if (tool !== 'move') return;
  const t = hitToken(e.offsetX, e.offsetY);
  if (t && canEdit(t)) openTokenDialog(t);
});

/* --- จัดการโทเคน --- */
function saveLocalTokens() { if (!online()) store.set(lk('tokens'), tokens); }

function loadTokImg(id, src) {
  if (typeof src !== 'string' || !src.startsWith('data:image/')) return;
  const im = new Image();
  im.onload = () => { tokImgs[id] = im; draw(); };
  im.src = src;
}
// ครอปกลางเป็นสี่เหลี่ยมจัตุรัส 128px
async function makeTokenImage(file) {
  const bmp = await loadBitmap(file);
  const bw = bmp.width || bmp.naturalWidth, bh = bmp.height || bmp.naturalHeight;
  const side = Math.min(bw, bh);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  c.getContext('2d').drawImage(bmp, (bw - side) / 2, (bh - side) / 2, side, side, 0, 0, 128, 128);
  for (const q of [0.82, 0.65, 0.5]) {
    let url = c.toDataURL('image/webp', q);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q);
    if (url.length <= 60000) return url;
  }
  throw new Error('too big');
}

async function commitMove(d) {
  const t = tokens[d.id];
  if (!online()) { saveLocalTokens(); draw(); return; }
  try {
    await fb.D.update(sref(`tokens/${t.id}`), { x: t.x, y: t.y });
  } catch {
    t.x = d.sx; t.y = d.sy; draw();
    toast('ย้ายไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)');
  }
}

function tokenData(t) {
  const o = { name: t.name, x: t.x, y: t.y, size: t.size, color: t.color, owner: t.owner };
  if (t.hpMax != null) { o.hpMax = t.hpMax; o.hp = t.hp ?? t.hpMax; }
  if (t.conds.length) o.conds = t.conds.join(',');
  if (t.hidden) o.hidden = true;
  if (t.locked) o.locked = true;
  if (t.cid) o.cid = t.cid;
  if (t.img) o.img = true;
  return o;
}

async function tokenPut(t) {
  if (online()) {
    try {
      await fb.D.set(sref(`tokens/${t.id}`), tokenData(t));
    } catch { toast('บันทึกโทเคนไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)'); }
  } else {
    tokens[t.id] = t;
    if (t.imgSrc) loadTokImg(t.id, t.imgSrc); else delete tokImgs[t.id];
    saveLocalTokens();
    renderTokenList(); updateSelBar(); draw();
  }
}

// แก้บางช่องของโทเคน (HP สถานะ ซ่อน ล็อก)
async function patchToken(t, f) {
  const old = {};
  Object.keys(f).forEach(k => { old[k] = t[k]; });
  Object.assign(t, f);
  draw();
  if (!online()) { saveLocalTokens(); renderTokenList(); return; }
  const p = {};
  Object.entries(f).forEach(([k, v]) => {
    if (k === 'conds') p.conds = v.length ? v.join(',') : null;
    else if (k === 'hidden' || k === 'locked' || k === 'img') p[k] = v ? true : null;
    else p[k] = v === undefined ? null : v;
  });
  try { await fb.D.update(sref(`tokens/${t.id}`), p); } catch {
    Object.assign(t, old); draw();
    toast('ไม่สำเร็จ (ไม่มีสิทธิ์หรือเน็ตหลุด)');
  }
}

async function tokenDelete(id) {
  const t = tokens[id];
  if (online()) {
    try {
      if (t?.img) await fb.D.remove(sref(`tokimg/${id}`)); // ลบรูปก่อน (กฎตรวจเจ้าของจากข้อมูล tokens)
      await fb.D.remove(sref(`tokens/${id}`));
    } catch { toast('ลบไม่สำเร็จ (ไม่มีสิทธิ์)'); }
  } else {
    delete tokens[id];
    delete tokImgs[id];
    if (selected === id) selected = null;
    saveLocalTokens();
    renderTokenList(); updateSelBar(); draw();
  }
}

// ผูก HP โทเคนกับตัวละครในชีท (ทั้งสองทาง)
function pushCharToTokens() {
  chars.forEach(c => Object.values(tokens).forEach(t => {
    if (t.cid !== c.id || t.owner !== myId()) return;
    const mh = maxHp(c), hp = c.hp ?? mh;
    if (t.hpMax !== mh || t.hp !== hp) patchToken(t, { hpMax: mh, hp });
  }));
}
function tokenHpToChar(t) {
  if (!t.cid || t.owner !== myId() || t.hp == null) return;
  const c = chars.find(x => x.id === t.cid);
  if (!c) return;
  c.hp = clamp(t.hp, 0, maxHp(c) + 999);
  changed();
  if (c.id === activeId) $('#f-hp').value = c.hp;
}

function selectToken(id) {
  selected = id;
  if (id) selectedMap = null;
  updateSelBar();
  renderTokenList();
  renderMapList();
  draw();
}
function selectMap(id) {
  selectedMap = id;
  selected = null;
  updateSelBar();
  renderTokenList();
  renderMapList();
  draw();
}
function clearSelection() {
  selected = null;
  selectedMap = null;
  updateSelBar();
  renderTokenList();
  renderMapList();
  draw();
}
function centerRect(x, y, w, h) {
  if (!W) return;
  view.x = W / 2 - (x + w / 2) * CELL * view.s;
  view.y = H / 2 - (y + h / 2) * CELL * view.s;
  draw();
}

function updateSelBar() {
  const t = tokens[selected];
  const m = maps[selectedMap];
  const obj = t || m;
  $('#selBar').hidden = !obj;
  if (!obj) return;
  const ok = t ? canEdit(t) : canEditMap(m);
  $('#selName').textContent = (m ? '🖼 ' : '') + (obj.name || '(ไม่มีชื่อ)');
  $('#selEdit').hidden = !t;
  $('#selDup').hidden = !t;
  $('#selSt').hidden = !t || !(ok || iAmDM());
  $('#selFit').hidden = !m;
  $('#selEdit').disabled = !ok && !iAmDM();
  $('#selFit').disabled = !ok;
  $('#selDel').disabled = !ok && !iAmDM();
}

function centerOn(t) {
  if (!W) return;
  view.x = W / 2 - (t.x + t.size / 2) * CELL * view.s;
  view.y = H / 2 - (t.y + t.size / 2) * CELL * view.s;
  draw();
}

function freeSpot(size, anchor) {
  const c = toWorld(W / 2, H / 2);
  const bx = anchor ? clamp(anchor.x, 0, GRID - size) : clamp(Math.floor(c.x / CELL - size / 2), 0, GRID - size);
  const by = anchor ? clamp(anchor.y, 0, GRID - size) : clamp(Math.floor(c.y / CELL - size / 2), 0, GRID - size);
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
  const arr = visTokens().sort((a, b) => a.name.localeCompare(b.name, 'th'));
  if (!arr.length) { box.append(h('div', { class: 'muted small', text: 'ยังไม่มีโทเคน — กด "+ โทเคน" หรือ "ตัวฉัน"' })); return; }
  arr.forEach(t => {
    const hp = t.hpMax != null && showHp(t) ? `${t.hp ?? t.hpMax}/${t.hpMax}` : '';
    box.append(h('button', { class: 'tok-row' + (t.id === selected ? ' sel' : ''), onclick: () => { selectToken(t.id); centerOn(t); } },
      h('i', { class: 'dot', style: `background:${safeColor(t.color)}` }),
      h('span', { text: `${t.hidden ? '🙈 ' : ''}${t.name || '(ไม่มีชื่อ)'}${t.conds.length ? ' ' + t.conds.map(k => condInfo(k)[1]).join('') : ''}` }),
      h('small', { class: 'muted', text: `${hp ? 'HP ' + hp + ' · ' : ''}${t.x + 1},${t.y + 1}` })));
  });
}

/* --- HP / สถานะ --- */
let stTok = null;
function openStDialog(t) {
  stTok = t.id;
  $('#st-val').value = '';
  renderSt();
  $('#stDialog').showModal();
}
function renderSt() {
  const t = tokens[stTok];
  if (!t) { $('#stDialog').close(); return; }
  $('#st-title').textContent = t.name;
  $('#st-hp').textContent = t.hpMax != null ? `${t.hp ?? t.hpMax} / ${t.hpMax}` : 'ยังไม่ตั้ง HP';
  const box = $('#st-conds');
  box.innerHTML = '';
  CONDS.forEach(([k, ico, en]) => box.append(h('button', {
    type: 'button', class: 'cond' + (t.conds.includes(k) ? ' on' : ''), text: `${ico} ${en}`,
    onclick: async () => {
      const next = t.conds.includes(k) ? t.conds.filter(x => x !== k) : [...t.conds, k];
      await patchToken(t, { conds: next });
      renderSt();
    },
  })));
}
async function stApplyHp(delta, absolute) {
  const t = tokens[stTok];
  if (!t) return;
  let hpMax = t.hpMax;
  let hp;
  if (absolute != null) {
    if (hpMax == null) { hpMax = Math.max(1, absolute); }
    hp = clamp(absolute, 0, hpMax);
  } else {
    if (hpMax == null) { toast('ยังไม่ตั้ง HP — ใส่ค่าแล้วกด "ตั้งเป็นค่านี้" ก่อน'); return; }
    hp = clamp((t.hp ?? hpMax) + delta, 0, hpMax);
  }
  await patchToken(t, { hp, hpMax });
  tokenHpToChar(t);
  renderSt();
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
let tokImgPending = null; // { data } หรือ { clear: true }

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
  $('#tok-hp').value = t?.hp ?? '';
  $('#tok-hpmax').value = t?.hpMax ?? '';
  $('#tok-hidden').checked = !!t?.hidden;
  $('#tok-locked').checked = !!t?.locked;
  $('#tok-dmopts').hidden = !iAmDM();
  tokImgPending = null;
  const prev = $('#tok-imgprev');
  if (t && tokImgs[t.id]) { prev.src = tokImgs[t.id].src; prev.hidden = false; } else { prev.removeAttribute('src'); prev.hidden = true; }
  tokColor = t?.color || colorFor(myId());
  buildSwatches();
  $('#tok-del').hidden = !t;
  $('#tokDialog').showModal();
  $('#tok-name').focus();
}


/* =====================================================================
   อินิเชียทีฟ (ลำดับตา) — ซิงก์ที่ rooms/<code>/init
   ===================================================================== */
const initSorted = () => Object.values(initState.entries).sort((a, b) => (b.val ?? -999) - (a.val ?? -999) || a.ord - b.ord);
function saveInit() { if (!online()) store.set('init', initState); }

// ผู้เล่นไม่เห็นรายการของโทเคนที่ถูกซ่อน/อยู่ในหมอก
function initVisible(e) {
  if (iAmDM()) return true;
  const t = e.tid && tokens[e.tid];
  return !t || tokenVisible(t);
}

async function initSetEntry(e) {
  if (online()) {
    try { await fb.D.set(roomRef(`init/entries/${e.id}`), { name: e.name, val: e.val, tid: e.tid, owner: e.owner, ord: e.ord }); }
    catch { toast('บันทึกอินิเชียทีฟไม่สำเร็จ'); }
  } else {
    initState.entries[e.id] = e;
    saveInit(); renderInit(); draw();
  }
}
async function initDelEntry(id) {
  if (online()) {
    try { await fb.D.remove(roomRef(`init/entries/${id}`)); } catch { toast('ลบไม่สำเร็จ (ไม่มีสิทธิ์)'); }
  } else {
    delete initState.entries[id];
    if (initState.turn === id) initState.turn = '';
    saveInit(); renderInit(); draw();
  }
}
async function initSetTurn(turn, round) {
  if (online()) {
    try { await fb.D.update(roomRef('init'), { turn, round }); } catch { toast('เฉพาะ DM'); }
  } else {
    const prev = initState.turn;
    initState.turn = turn; initState.round = round;
    saveInit(); renderInit(); draw();
    if (turn && turn !== prev) announceTurn();
  }
}

function announceTurn() {
  const e = initState.entries[initState.turn];
  if (!e) return;
  if (initVisible(e)) toast(`ถึงตา ${e.name} (รอบ ${initState.round})`, 3000);
  const t = e.tid && tokens[e.tid];
  if (t && tokenVisible(t)) centerOn(t);
}

function renderInit() {
  const box = $('#initList');
  if (!box) return;
  box.innerHTML = '';
  const dm = iAmDM();
  $$('[data-dm]').forEach(b => { b.hidden = !dm; });
  const list = initSorted().filter(initVisible);
  $('#initRound').hidden = !list.length;
  $('#initRound').textContent = `รอบ ${initState.round}`;
  if (!list.length) box.append(h('div', { class: 'muted small', text: 'ยังไม่มีรายการ — ผู้เล่นกด "🎲 ทอยของฉัน" ส่วน DM กด "+ โทเคนทั้งหมด"' }));
  list.forEach(e => {
    const can = dm || e.owner === myId();
    const input = h('input', {
      type: 'number', inputmode: 'numeric', value: e.val ?? '', placeholder: '–', disabled: !can || null, 'aria-label': 'ค่าอินิเชียทีฟ',
      onchange: ev => initSetEntry({ ...e, val: ev.target.value === '' ? null : Math.round(Number(ev.target.value)) }),
    });
    box.append(h('div', { class: 'init-row' + (e.id === initState.turn ? ' now' : '') },
      h('span', { text: e.id === initState.turn ? '▶' : '' }),
      h('b', {
        text: e.name,
        onclick: () => { const t = e.tid && tokens[e.tid]; if (t && tokenVisible(t)) { selectToken(t.id); centerOn(t); } },
      }),
      input,
      can ? h('button', { class: 'danger', text: '✕', 'aria-label': 'ลบ', onclick: () => initDelEntry(e.id) }) : null));
  });
  $('#initHint').textContent = dm
    ? 'DM: กด "▶ ตาถัดไป" เพื่อเลื่อนตา · แก้ค่าในช่องได้ · โทเคนที่ถึงตาจะมีวงเขียว'
    : 'ถึงตาใครระบบจะแจ้งและวงเขียวจะขึ้นที่โทเคน · แก้ได้เฉพาะค่าของตัวเอง';
  const chip = $('#turnChip');
  const cur = initState.entries[initState.turn];
  chip.hidden = !(cur && initVisible(cur));
  if (!chip.hidden) chip.textContent = `ตา: ${cur.name} · รอบ ${initState.round}`;
}

function bindInit() {
  $('#initMine').onclick = () => {
    const c = cur();
    const r = emitRoll('Initiative', bonusExpr(initBonus(c)));
    if (!r) return;
    const mt = Object.values(tokens).find(t => t.owner === myId() && (t.cid === c.id || t.name === c.name));
    initSetEntry({ id: `u${String(myId()).slice(0, 10)}_${c.id}`, name: c.name || 'ตัวฉัน', val: r.total, tid: mt?.id || '', owner: myId(), ord: Date.now() });
  };
  $('#initAddAll').onclick = async () => {
    const have = new Set(Object.values(initState.entries).map(e => e.tid).filter(Boolean));
    let i = 0;
    for (const t of Object.values(tokens)) {
      if (have.has(t.id)) continue;
      await initSetEntry({ id: `t_${t.id}`, name: t.name, val: null, tid: t.id, owner: t.owner, ord: Date.now() + i++ });
    }
    if (!i) toast('โทเคนทุกตัวอยู่ในรายการแล้ว');
  };
  $('#initRollAll').onclick = async () => {
    let n = 0;
    for (const e of Object.values(initState.entries)) {
      if (e.val != null) continue;
      const bonus = e.owner && e.owner !== room.dm ? Number(party[e.owner]?.init) || 0 : 0;
      const res = rollExpr(`1d20${bonus >= 0 ? '+' : '-'}${Math.abs(bonus)}`, 'normal');
      if (res) { await initSetEntry({ ...e, val: res.total }); n++; }
    }
    toast(n ? `ทอยให้ ${n} รายการแล้ว` : 'ทุกรายการมีค่าแล้ว');
  };
  $('#initNext').onclick = () => {
    const list = initSorted().filter(e => e.val != null);
    if (!list.length) { toast('ยังไม่มีค่าอินิเชียทีฟ'); return; }
    let i = list.findIndex(e => e.id === initState.turn);
    let round = initState.round;
    if (i < 0) { i = 0; round = 1; } else { i++; if (i >= list.length) { i = 0; round++; } }
    initSetTurn(list[i].id, round);
  };
  $('#initClear').onclick = async () => {
    if (!confirm('จบการต่อสู้และล้างรายการอินิเชียทีฟ?')) return;
    if (online()) { try { await fb.D.remove(roomRef('init')); } catch { toast('เฉพาะ DM'); } }
    else { initState = normInit({}); saveInit(); renderInit(); draw(); }
  };
}

/* =====================================================================
   ฉาก (Scene)
   ===================================================================== */
function sceneEntries() {
  const src = online() ? room.scenes : scenes;
  const rest = Object.entries(src).filter(([, v]) => v && typeof v === 'object').sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  return [['main', { name: 'ฉากหลัก' }], ...rest];
}
function renderScenes() {
  const list = $('#sceneList');
  if (!list) return;
  const ents = sceneEntries();
  list.innerHTML = '';
  ents.forEach(([id, v]) => list.append(h('button', {
    class: 'tok-row' + (id === scene ? ' sel' : ''), onclick: () => sceneSelect(id),
  }, h('span', { text: `${id === scene ? '▶ ' : ''}${v.name || 'ฉาก'}` }))));
  const sel = $('#sceneSel');
  sel.innerHTML = '';
  ents.forEach(([id, v]) => sel.append(h('option', { value: id, text: `ฉาก: ${v.name || 'ฉาก'}`, selected: id === scene })));
  sel.hidden = !(iAmDM() && ents.length > 1);
  $('#sceneDel').disabled = scene === 'main';
  $('#sceneRename').disabled = scene === 'main';
}
async function sceneSelect(id) {
  if (!iAmDM() || id === scene) return;
  if (online()) {
    try { await fb.D.update(roomRef('meta'), { scene: id }); } catch { toast('เฉพาะ DM'); }
  } else {
    store.set('scene', id);
    switchScene(id);
  }
}
async function sceneAdd() {
  const name = (prompt('ชื่อฉากใหม่ (เช่น ห้องบอส, ในเมือง)') || '').trim().slice(0, 30);
  if (!name) return;
  const id = uid8();
  if (online()) {
    try { await fb.D.update(roomRef('meta'), { [`scenes/${id}`]: { name, ts: Date.now() }, scene: id }); } catch { toast('เฉพาะ DM'); }
  } else {
    scenes[id] = { name, ts: Date.now() };
    store.set('scenes', scenes);
    store.set('scene', id);
    switchScene(id);
  }
}
async function sceneRename() {
  if (scene === 'main') return;
  const name = (prompt('ชื่อฉากใหม่', sceneName(scene)) || '').trim().slice(0, 30);
  if (!name) return;
  if (online()) {
    try { await fb.D.update(roomRef('meta'), { [`scenes/${scene}/name`]: name }); } catch { toast('เฉพาะ DM'); }
  } else {
    scenes[scene].name = name;
    store.set('scenes', scenes);
    renderScenes(); draw();
  }
}
async function sceneDelete() {
  const id = scene;
  if (id === 'main') return;
  if (!confirm(`ลบฉาก "${sceneName(id)}" พร้อมโทเคน รูป หมอก และเส้นวาดทั้งหมดในฉากนี้?`)) return;
  if (online()) {
    try {
      await fb.D.update(roomRef('meta'), { scene: 'main' });
      await fb.D.remove(roomRef(`sdata/${id}`));
      await fb.D.update(roomRef('meta'), { [`scenes/${id}`]: null });
    } catch { toast('เฉพาะ DM'); }
  } else {
    ['tokens', 'maps', 'fog', 'draw'].forEach(k => store.del(`${k}@${id}`));
    delete scenes[id];
    store.set('scenes', scenes);
    store.set('scene', 'main');
    switchScene('main');
  }
}

/* =====================================================================
   UI ของห้อง
   ===================================================================== */
function updateRoomUI() {
  const b = $('#roomBtn');
  b.classList.toggle('on', online());
  b.textContent = online() ? `ห้อง ${room.code} · ${room.isDM ? 'DM' : 'ผู้เล่น'}` : 'ออฟไลน์';
  $('#dmBox').hidden = !iAmDM();
  $('#fogBtn').hidden = !iAmDM();
  if (!iAmDM()) fogStop();
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
  renderInit();
  renderScenes();
  buildToolOpts();
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
    const mine = Object.values(tokens).find(t => t.owner === myId() && (t.cid === c.id || t.name === name));
    if (mine) { selectToken(mine.id); centerOn(mine); return; }
    const pos = freeSpot(1);
    const mh = maxHp(c);
    tokenPut(normToken({ name, size: 1, color: colorFor(myId()), x: pos.x, y: pos.y, owner: myId(), cid: c.id, hpMax: mh, hp: c.hp ?? mh }, uid8()));
  };
  $('#zoomIn').onclick = () => { zoomAt(W / 2, H / 2, 1.25); draw(); };
  $('#zoomOut').onclick = () => { zoomAt(W / 2, H / 2, 1 / 1.25); draw(); };
  $('#zoomFit').onclick = () => { fitView(); draw(); };

  $('#toolbar2').addEventListener('click', e => {
    const b = e.target.closest('button[data-tool]');
    if (!b) return;
    setTool(tool === b.dataset.tool && tool !== 'move' ? 'move' : b.dataset.tool);
  });
  $('#fogReveal').onclick = () => { fogMode = 'reveal'; fogUI(); };
  $('#fogHide').onclick = () => { fogMode = 'hide'; fogUI(); };
  $('#fogBrush').onclick = () => { fogBrush = fogBrush === 1 ? 3 : fogBrush === 3 ? 5 : 1; fogUI(); };
  $('#fogAll').onclick = () => { fog = '1'.repeat(GRID * GRID); fogSave(); draw(); };
  $('#fogOff').onclick = () => { fog = ''; fogSave(); draw(); };
  $('#fogDone').onclick = () => setTool('move');

  $('#selDup').onclick = async () => {
    const t = tokens[selected];
    if (!t) return;
    const base = t.name.replace(/\s+\d+$/, '') || 'โทเคน';
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('^' + esc + '(?:\\s+(\\d+))?$');
    let max = 1;
    Object.values(tokens).forEach(o => { const m = re.exec(o.name); if (m) max = Math.max(max, m[1] ? +m[1] : 1); });
    const name = `${base} ${max + 1}`.slice(0, 40);
    const pos = freeSpot(t.size, { x: t.x + t.size, y: t.y });
    const id = uid8();
    const hasImg = t.img && tokImgs[t.id];
    const nt = normToken({
      name, size: t.size, color: t.color, x: pos.x, y: pos.y, owner: myId(),
      hpMax: t.hpMax, hp: t.hpMax, hidden: t.hidden, img: !!hasImg, imgSrc: hasImg ? tokImgs[t.id].src : undefined,
    }, id);
    await tokenPut(nt);
    if (hasImg && online()) { try { await fb.D.set(sref(`tokimg/${id}`), tokImgs[t.id].src); } catch { /* ignore */ } }
    if (!online()) selectToken(id);
  };
  $('#selSt').onclick = () => { const t = tokens[selected]; if (t) openStDialog(t); };
  $('#selEdit').onclick = () => { const t = tokens[selected]; if (t) openTokenDialog(t); };
  $('#selDel').onclick = () => {
    const m = maps[selectedMap];
    if (m) { if (confirm(`ลบรูป "${m.name}" ?`)) mapDelete(m.id); return; }
    const t = tokens[selected];
    if (t && confirm(`ลบโทเคน "${t.name}" ?`)) tokenDelete(t.id);
  };
  $('#selFit').onclick = () => {
    const m = maps[selectedMap];
    if (!m) return;
    const wide = m.w >= m.h;
    patchMap(m, {
      x: 0, y: 0,
      w: wide ? GRID : Math.max(1, round2((GRID * m.w) / m.h)),
      h: wide ? Math.max(1, round2((GRID * m.h) / m.w)) : GRID,
    });
  };
  $('#imgAdd').onclick = () => $('#imgFile').click();
  $('#imgFile').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    await addMapFromFile(f);
  };
  $('#mapClear').onclick = async () => {
    if (!confirm('ลบรูปแผนที่ทั้งหมดบนกระดาน?')) return;
    if (online()) {
      try {
        await fb.D.remove(sref('mapimg'));
        await fb.D.remove(sref('maps'));
      } catch { toast('ไม่มีสิทธิ์'); }
    } else {
      maps = {};
      Object.keys(imgs).forEach(k => delete imgs[k]);
      selectedMap = null;
      saveLocalMaps();
      renderMapList(); updateSelBar(); draw();
    }
  };

  // กล่องแก้ไขโทเคน
  $('#tok-cancel').onclick = () => $('#tokDialog').close();
  $('#tok-del').onclick = async () => {
    if (tokEditing) await tokenDelete(tokEditing.id);
    $('#tokDialog').close();
  };
  $('#tok-imgpick').onclick = () => $('#tok-imgfile').click();
  $('#tok-imgfile').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    try {
      const data = await makeTokenImage(f);
      tokImgPending = { data };
      $('#tok-imgprev').src = data; $('#tok-imgprev').hidden = false;
    } catch { toast('อ่านหรือย่อรูปนี้ไม่ได้'); }
  };
  $('#tok-imgclear').onclick = () => {
    tokImgPending = { clear: true };
    $('#tok-imgprev').removeAttribute('src'); $('#tok-imgprev').hidden = true;
  };
  $('#tok-save').onclick = async () => {
    const name = $('#tok-name').value.trim().slice(0, 40) || 'โทเคน';
    const size = Number($('#tok-size').value);
    const iv = v => (v === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)));
    let hpMax = iv($('#tok-hpmax').value);
    let hp = iv($('#tok-hp').value);
    if (hpMax == null && hp != null) hpMax = Math.max(hp, 0);
    if (hpMax != null && hp == null) hp = hpMax;
    if (hpMax != null) { hpMax = clamp(hpMax, 0, 9999); hp = clamp(hp, 0, hpMax); }

    const existing = tokEditing && tokens[tokEditing.id];
    let t;
    if (existing) {
      t = { ...existing };
    } else {
      const pos = freeSpot(size);
      t = normToken({ x: pos.x, y: pos.y, owner: myId() }, uid8());
    }
    Object.assign(t, { name, size, color: tokColor, hpMax, hp });
    if (iAmDM()) { t.hidden = $('#tok-hidden').checked; t.locked = $('#tok-locked').checked; }
    t.x = clamp(t.x, 0, GRID - size);
    t.y = clamp(t.y, 0, GRID - size);

    const hadImg = !!t.img;
    if (tokImgPending?.data) t.img = true;
    else if (tokImgPending?.clear) t.img = false;
    if (!online()) {
      if (tokImgPending?.data) t.imgSrc = tokImgPending.data;
      else if (tokImgPending?.clear) t.imgSrc = undefined;
    }
    if (online() && tokImgPending?.clear && hadImg) { try { await fb.D.remove(sref(`tokimg/${t.id}`)); } catch { /* ignore */ } }
    await tokenPut(t);
    if (online() && tokImgPending?.data) {
      try { await fb.D.set(sref(`tokimg/${t.id}`), tokImgPending.data); } catch { toast('ส่งรูปโทเคนไม่สำเร็จ'); }
    }
    if (existing && t.cid) tokenHpToChar(t);
    tokImgPending = null;
    $('#tokDialog').close();
  };

  // HP / สถานะ
  $('#st-close').onclick = () => $('#stDialog').close();
  $$('#stDialog [data-q]').forEach(b => { b.onclick = () => stApplyHp(Number(b.dataset.q), null); });
  const val = () => { const v = $('#st-val').value; return v === '' ? null : Math.round(Number(v)); };
  $('#st-dmg').onclick = () => { const v = val(); if (v == null) { toast('ใส่ตัวเลขก่อน'); return; } stApplyHp(-Math.abs(v), null); $('#st-val').value = ''; };
  $('#st-heal').onclick = () => { const v = val(); if (v == null) { toast('ใส่ตัวเลขก่อน'); return; } stApplyHp(Math.abs(v), null); $('#st-val').value = ''; };
  $('#st-set').onclick = () => { const v = val(); if (v == null) { toast('ใส่ตัวเลขก่อน'); return; } stApplyHp(0, Math.max(0, v)); $('#st-val').value = ''; };

  // ฉาก / อินิเชียทีฟ
  $('#sceneAdd').onclick = sceneAdd;
  $('#sceneRename').onclick = sceneRename;
  $('#sceneDel').onclick = sceneDelete;
  $('#sceneSel').onchange = e => sceneSelect(e.target.value);
  bindInit();

  $('#bgSet').onclick = async () => {
    const url = $('#bgUrl').value.trim();
    if (url && !/^https?:\/\//i.test(url)) { toast('URL ต้องขึ้นต้นด้วย http(s)://'); return; }
    await setBg(url);
  };
  $('#bgClear').onclick = () => { $('#bgUrl').value = ''; setBg(''); };
  $('#tokClear').onclick = async () => {
    if (!confirm('ล้างโทเคนทั้งหมดบนกระดาน (ฉากนี้)?')) return;
    if (online()) {
      try {
        await fb.D.remove(sref('tokimg'));
        await fb.D.remove(sref('tokens'));
      } catch { toast('ไม่มีสิทธิ์'); }
    } else { tokens = {}; selected = null; Object.keys(tokImgs).forEach(k => delete tokImgs[k]); saveLocalTokens(); renderTokenList(); updateSelBar(); draw(); }
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
  rebuildLocalImgs();
  Object.values(tokens).forEach(t => { if (t.imgSrc) loadTokImg(t.id, t.imgSrc); });
  renderInit();
  renderScenes();
  renderMapList();
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
