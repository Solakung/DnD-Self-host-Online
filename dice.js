// dice.js — ตัวทอยลูกเต๋าล้วนๆ (ไม่แตะ DOM) เพื่อให้ทดสอบง่าย

/** สุ่ม 1..n แบบไม่เอนเอียง (rejection sampling) */
export function rnd(n) {
  const a = new Uint32Array(1);
  const max = Math.floor(0x100000000 / n) * n;
  let v;
  do {
    crypto.getRandomValues(a);
    v = a[0];
  } while (v >= max);
  return (v % n) + 1;
}

/**
 * แปลงสูตรเช่น "2d6+3", "d20-1", "1d8+1d4+2" เป็น terms
 * คืน null ถ้าสูตรไม่ถูกต้อง
 */
export function parseExpr(input) {
  const s = String(input).replace(/\s+/g, '').toLowerCase().replace(/−/g, '-');
  if (!s) return null;
  const parts = s.match(/[+-]?[^+-]+/g);
  if (!parts || parts.join('') !== s) return null;
  const terms = [];
  for (const p of parts) {
    const d = p.match(/^([+-]?)(\d*)d(\d+)$/);
    if (d) {
      const count = d[2] === '' ? 1 : Number(d[2]);
      const sides = Number(d[3]);
      if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
      terms.push({ sign: d[1] === '-' ? -1 : 1, count, sides });
      continue;
    }
    const n = p.match(/^([+-]?)(\d+)$/);
    if (n) {
      terms.push({ sign: n[1] === '-' ? -1 : 1, flat: Number(n[2]) });
      continue;
    }
    return null;
  }
  return terms.some(t => t.sides) ? terms : null;
}

/**
 * ทอยตามสูตร mode = 'normal' | 'adv' | 'dis' (มีผลกับ d20 ตัวเดียวตัวแรกเท่านั้น)
 * nat = 20 หรือ 1 ถ้า d20 ตัวแรกออกหน้านั้น ไม่งั้น 0
 */
export function rollExpr(expr, mode = 'normal') {
  const terms = parseExpr(expr);
  if (!terms) return null;
  let total = 0;
  let firstD20 = null;
  let usedMode = '';
  let advDone = false;
  const detail = [];

  terms.forEach((t, i) => {
    const sign = t.sign < 0 ? '−' : i ? '+' : '';
    const lead = sign ? sign + ' ' : '';
    if (t.flat != null) {
      total += t.sign * t.flat;
      detail.push(lead + t.flat);
      return;
    }
    let sub;
    if (!advDone && mode !== 'normal' && t.sides === 20 && t.count === 1 && t.sign > 0) {
      const a = rnd(20);
      const b = rnd(20);
      sub = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
      advDone = true;
      usedMode = mode;
      detail.push(`${lead}d20 [${a}, ${b}] → ${sub}`);
      if (firstD20 === null) firstD20 = sub;
    } else {
      const rolls = Array.from({ length: t.count }, () => rnd(t.sides));
      sub = rolls.reduce((s, x) => s + x, 0);
      detail.push(`${lead}${t.count}d${t.sides} [${rolls.join(', ')}]`);
      if (firstD20 === null && t.sides === 20 && t.count === 1 && t.sign > 0) firstD20 = rolls[0];
    }
    total += t.sign * sub;
  });

  return {
    expr,
    total,
    detail: detail.join(' '),
    nat: firstD20 === 20 || firstD20 === 1 ? firstD20 : 0,
    mode: usedMode,
  };
}
