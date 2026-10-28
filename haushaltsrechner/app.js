'use strict';

/* ===== Konstanten ===== */
const STORAGE_KEY = 'haushalt.v1';
const CATS = [
  { id: 'fix',  label: 'Fixkosten',            color: 'var(--c-fix)' },
  { id: 'var',  label: 'Variable Kosten',      color: 'var(--c-var)' },
  { id: 'misc', label: 'Sonstiges',            color: 'var(--c-misc)' },
  { id: 'save', label: 'Sparen & Investieren', color: 'var(--c-save)' },
];

/* ===== Format ===== */
const Format = {
  eur: (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n || 0),
  pct: (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n || 0) + ' %',
  // "1.234,56 €" / "12,5" / "12.5" -> Zahl; ungültig -> NaN
  parse(str) {
    let s = String(str).replace(/[€\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return s === '' ? NaN : Number(s);
  },
  input: (n) => (n ? String(n).replace('.', ',') : ''),
};

/* ===== Calc (reine Funktionen) ===== */
const Calc = {
  round2: (n) => Math.round((n + Number.EPSILON) * 100) / 100,
  num: (n) => (Number.isFinite(n) ? n : 0),

  emptyMonth: () => ({ incomeA: { netto: 0, sonder: 0 }, incomeB: { netto: 0, sonder: 0 }, items: [] }),

  income(inc) { return Calc.num(inc && inc.netto) + Calc.num(inc && inc.sonder); },

  compute(month, settings) {
    const r = Calc.round2;
    const incA = Calc.income(month.incomeA), incB = Calc.income(month.incomeB);
    const total = incA + incB;
    const keyA = settings.split === '50/50' || total <= 0 ? 0.5 : incA / total;
    const zero = () => Object.fromEntries(CATS.map((c) => [c.id, 0]));
    const shared = zero(), ownA = zero(), ownB = zero();
    for (const it of month.items) {
      const target = it.owner === 'A' ? ownA : it.owner === 'B' ? ownB : shared;
      target[it.cat] = r(target[it.cat] + Calc.num(it.amount));
    }
    const shareA = zero(), shareB = zero();
    for (const c of CATS) {
      shareA[c.id] = r(shared[c.id] * keyA);
      shareB[c.id] = r(shared[c.id] - shareA[c.id]); // Summe bleibt cent-genau
    }
    const person = (income, share, own) => {
      const sum = (o, ids) => r(ids.reduce((a, id) => a + o[id], 0));
      const costIds = ['fix', 'var', 'misc'];
      const byCat = Object.fromEntries(CATS.map((c) => [c.id, r(share[c.id] + own[c.id])]));
      const sharedCosts = sum(share, costIds), ownCosts = sum(own, costIds);
      const saving = r(share.save + own.save);
      return {
        income, sharedCosts, ownCosts, saving, byCat,
        transfer: sum(share, CATS.map((c) => c.id)), // Überweisung aufs Gemeinschaftskonto
        rest: r(income - sharedCosts - ownCosts - saving),
        key: 0,
      };
    };
    const A = person(incA, shareA, ownA), B = person(incB, shareB, ownB);
    A.key = keyA; B.key = 1 - keyA;
    const byCat = Object.fromEntries(CATS.map((c) => [c.id, r(A.byCat[c.id] + B.byCat[c.id])]));
    const saving = r(A.saving + B.saving);
    return {
      A, B,
      total: {
        income: r(total), byCat, saving,
        expenses: r(byCat.fix + byCat.var + byCat.misc),
        savingsRate: total > 0 ? (saving / total) * 100 : 0,
        rest: r(A.rest + B.rest),
      },
    };
  },

  // Vormonat -> neuer Monat: Einkommen übernehmen (Sonderzahlung 0), nur wiederkehrende Posten
  copyFrom(prev, newId) {
    return {
      incomeA: { netto: prev.incomeA.netto, sonder: 0 },
      incomeB: { netto: prev.incomeB.netto, sonder: 0 },
      items: prev.items.filter((i) => i.recurring).map((i) => ({ ...i, id: newId() })),
    };
  },
};

/* ===== Storage ===== */
const Store = {
  defaults: () => ({ version: 1, settings: { nameA: 'Person A', nameB: 'Person B', split: 'proportional' }, months: {} }),
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Store.validate(JSON.parse(raw)) || Store.defaults();
    } catch (e) { /* defekt oder blockiert -> Defaults */ }
    return Store.defaults();
  },
  save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch (e) { alert('Speichern im Browser nicht möglich. Bitte Export als Backup nutzen.'); return false; }
  },
  // Prüft/normalisiert importierte Daten; null bei ungültiger Struktur
  validate(d) {
    if (!d || typeof d !== 'object' || typeof d.months !== 'object' || !d.months) return null;
    const out = Store.defaults();
    Object.assign(out.settings, {
      nameA: String(d.settings?.nameA || out.settings.nameA),
      nameB: String(d.settings?.nameB || out.settings.nameB),
      split: d.settings?.split === '50/50' ? '50/50' : 'proportional',
    });
    for (const [key, m] of Object.entries(d.months)) {
      if (!/^\d{4}-\d{2}$/.test(key) || !m) continue;
      const inc = (x) => ({ netto: Calc.num(Number(x?.netto)), sonder: Calc.num(Number(x?.sonder)) });
      out.months[key] = {
        incomeA: inc(m.incomeA), incomeB: inc(m.incomeB),
        items: (Array.isArray(m.items) ? m.items : [])
          .filter((i) => i && CATS.some((c) => c.id === i.cat))
          .map((i) => ({
            id: String(i.id || Math.random().toString(36).slice(2)),
            cat: i.cat, name: String(i.name || '').slice(0, 60),
            amount: Calc.num(Number(i.amount)),
            owner: ['A', 'B'].includes(i.owner) ? i.owner : 'both',
            recurring: !!i.recurring,
          })),
      };
    }
    return out;
  },
};

/* ===== State ===== */
const state = {
  data: Store.load(),
  month: new Date().toISOString().slice(0, 7),
  tab: 'A', // 'A' | 'B' | 'G'
};
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const names = () => ({ A: state.data.settings.nameA, B: state.data.settings.nameB });
const curMonth = () => (state.data.months[state.month] ??= Calc.emptyMonth());
const persist = () => Store.save(state.data);
const shiftMonth = (key, d) => {
  const [y, m] = key.split('-').map(Number);
  const dt = new Date(y, m - 1 + d, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

/* ===== Render ===== */
const $ = (sel) => document.querySelector(sel);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const money = (n, cls) => h('span', { class: cls || (n < 0 ? 'neg' : '') }, Format.eur(n));

function card(label, value, sub, extra) {
  return h('div', { class: 'card ' + (extra || '') }, h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
}

function renderTabs() {
  const n = names();
  const tabs = $('#tabs');
  tabs.replaceChildren(...[['A', n.A], ['B', n.B], ['G', 'Gemeinsam']].map(([id, label]) =>
    h('button', { role: 'tab', 'aria-selected': state.tab === id, onclick: () => { state.tab = id; render(); } }, label)));
}

function renderWarnings(res) {
  const n = names();
  $('#warnings').replaceChildren(...['A', 'B'].filter((p) => res[p].rest < 0).map((p) =>
    h('div', { class: 'warn', role: 'alert' }, `⚠ ${n[p]} rutscht um ${Format.eur(-res[p].rest)} ins Minus.`)));
}

function renderCards(res) {
  const n = names(), t = res.total, s = state.data.settings;
  const cards = $('#cards');
  if (state.tab === 'G') {
    cards.replaceChildren(
      card('Gesamteinkommen', Format.eur(t.income)),
      card(`Überweisung ${n.A}`, Format.eur(res.A.transfer), 'aufs Gemeinschaftskonto'),
      card(`Überweisung ${n.B}`, Format.eur(res.B.transfer), 'aufs Gemeinschaftskonto'),
      ...CATS.map((c) => card(c.label, Format.eur(t.byCat[c.id]))),
      card('Sparquote', Format.pct(t.savingsRate), `${Format.eur(t.saving)} gespart`),
      card('Rest', h('span', { class: t.rest < 0 ? 'neg' : 'pos' }, Format.eur(t.rest)), 'zur freien Verfügung'));
  } else {
    const p = res[state.tab];
    const keyTxt = s.split === '50/50' ? '50 / 50' : `${Format.pct(p.key * 100)} nach Einkommen`;
    cards.replaceChildren(
      card('Einkommen', Format.eur(p.income)),
      card('Überweisung Gemeinschaftskonto', Format.eur(p.transfer), keyTxt),
      card('Anteil gemeinsame Kosten', Format.eur(p.sharedCosts)),
      card('Eigene Kosten', Format.eur(p.ownCosts)),
      card('Sparen / Investieren', Format.eur(p.saving)),
      card('Rest zur freien Verfügung', h('span', { class: p.rest < 0 ? 'neg' : 'pos' }, Format.eur(p.rest)), null, 'wide'));
  }
}

function renderIncome() {
  const m = curMonth(), n = names();
  const field = (who, key, label) => h('label', {}, label,
    h('input', {
      inputmode: 'decimal', placeholder: '0,00',
      value: Format.input(m['income' + who][key]),
      onchange: (e) => {
        const v = Format.parse(e.target.value);
        m['income' + who][key] = Number.isNaN(v) ? 0 : Math.max(0, v);
        persist(); render();
      },
    }));
  const who = state.tab === 'G' ? ['A', 'B'] : [state.tab];
  $('#income').replaceChildren(h('h2', {}, 'Einkommen'),
    h('div', { class: 'income-grid' }, who.flatMap((w) => [
      field(w, 'netto', `${n[w]} – Netto`), field(w, 'sonder', `${n[w]} – Sonderzahlung`)])));
}

function renderChart(res) {
  const data = state.tab === 'G' ? res.total.byCat : res[state.tab].byCat;
  const sum = CATS.reduce((a, c) => a + Math.max(0, data[c.id]), 0);
  const box = $('#chart');
  if (sum <= 0) { box.replaceChildren(h('h2', {}, 'Verteilung'), h('p', { class: 'empty' }, 'Noch keine Ausgaben.')); return; }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-1 -1 2 2'); svg.setAttribute('width', 160); svg.setAttribute('height', 160);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Kreisdiagramm der Ausgabenverteilung');
  let angle = -Math.PI / 2;
  const used = CATS.filter((c) => data[c.id] > 0);
  for (const c of used) {
    const frac = data[c.id] / sum;
    const el = document.createElementNS(NS, used.length === 1 ? 'circle' : 'path');
    if (used.length === 1) { el.setAttribute('r', 1); }
    else {
      const a2 = angle + frac * 2 * Math.PI, large = frac > 0.5 ? 1 : 0;
      el.setAttribute('d', `M0 0 L${Math.cos(angle)} ${Math.sin(angle)} A1 1 0 ${large} 1 ${Math.cos(a2)} ${Math.sin(a2)} Z`);
      angle = a2;
    }
    el.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue(c.color.slice(4, -1)) || '#888');
    svg.append(el);
  }
  box.replaceChildren(h('h2', {}, 'Verteilung'), h('div', { class: 'chart-wrap' }, svg,
    h('ul', { class: 'legend' }, CATS.map((c) => h('li', {},
      h('span', { class: 'dot', style: `background:${c.color}` }), c.label,
      h('span', { class: 'amt' }, `${Format.eur(data[c.id])} · ${Format.pct((data[c.id] / sum) * 100)}`))))));
}

function renderLists(res) {
  const m = curMonth(), n = names(), tab = state.tab;
  const visible = (it) => tab === 'G' || it.owner === 'both' || it.owner === tab;
  const ownerLabel = (o) => (o === 'both' ? 'Gemeinsam' : n[o]);
  $('#lists').replaceChildren(...CATS.map((c) => {
    const items = m.items.filter((i) => i.cat === c.id && visible(i));
    const total = tab === 'G' ? res.total.byCat[c.id] : res[tab].byCat[c.id];
    return h('div', { class: 'cat' },
      h('div', { class: 'cat-head' },
        h('h2', {}, h('span', { class: 'dot', style: `background:${c.color}` }), c.label),
        h('strong', {}, Format.eur(total)),
        h('button', { class: 'small', onclick: () => openItem(null, c.id) }, '+ Posten')),
      items.length ? items.map((it) => {
        const part = tab !== 'G' && it.owner === 'both' ? ` · dein Anteil ${Format.eur(Calc.round2(it.amount * res[tab].key))}` : '';
        return h('div', { class: 'item' },
          h('div', { class: 'name' }, it.name, it.recurring ? ' 🔁' : '',
            h('div', { class: 'meta' }, ownerLabel(it.owner) + part)),
          h('div', { class: 'amt' }, Format.eur(it.amount)),
          h('button', { class: 'ghost small', 'aria-label': 'Bearbeiten', onclick: () => openItem(it) }, '✎'),
          h('button', { class: 'danger small', 'aria-label': 'Löschen', onclick: () => deleteItem(it) }, '🗑'));
      }) : h('div', { class: 'empty' }, 'Keine Posten.'));
  }));
}

function render() {
  $('#month').value = state.month;
  const res = Calc.compute(curMonth(), state.data.settings);
  renderTabs(); renderWarnings(res); renderCards(res); renderIncome(); renderChart(res); renderLists(res);
  // Namen im Posten-Dialog
  const n = names(), sel = $('#item-form [name=owner]');
  sel.options[1].textContent = `Nur ${n.A}`; sel.options[2].textContent = `Nur ${n.B}`;
}

/* ===== Aktionen ===== */
let editing = null; // { id?, cat }
function openItem(item, cat) {
  const f = $('#item-form');
  editing = item ? { id: item.id, cat: item.cat } : { cat };
  $('#item-title').textContent = item ? 'Posten bearbeiten' : `Neuer Posten – ${CATS.find((c) => c.id === cat).label}`;
  f.name.value = item ? item.name : '';
  f.amount.value = item ? Format.input(item.amount) : '';
  f.owner.value = item ? item.owner : state.tab === 'G' ? 'both' : state.tab;
  f.recurring.checked = item ? item.recurring : false;
  $('#item-dialog').showModal();
}

function deleteItem(it) {
  if (!confirm(`„${it.name}“ löschen?`)) return;
  const m = curMonth();
  m.items = m.items.filter((i) => i.id !== it.id);
  persist(); render();
}

function copyPrevious() {
  const prevKey = shiftMonth(state.month, -1), prev = state.data.months[prevKey];
  if (!prev) { alert(`Für ${prevKey} gibt es keine Daten zum Kopieren.`); return; }
  const cur = state.data.months[state.month];
  if (cur && (cur.items.length || Calc.income(cur.incomeA) || Calc.income(cur.incomeB)) &&
      !confirm('Dieser Monat enthält bereits Daten. Mit dem Vormonat überschreiben?')) return;
  state.data.months[state.month] = Calc.copyFrom(prev, newId);
  persist(); render();
}

async function exportData() {
  const name = `haushalt-${new Date().toISOString().slice(0, 10)}.json`;
  const json = JSON.stringify(state.data, null, 2);
  const file = new File([json], name, { type: 'application/json' });
  // Am Handy: Teilen-Menü (Dateien, AirDrop, Mail …); sonst normaler Download
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Haushaltsrechner Backup' }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(file), download: name });
  document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
}

async function importData(file) {
  try {
    const parsed = Store.validate(JSON.parse(await file.text()));
    if (!parsed) throw new Error('Format');
    if (!confirm(`Import enthält ${Object.keys(parsed.months).length} Monat(e). Alle aktuellen Daten werden ersetzt. Fortfahren?`)) return;
    state.data = parsed; persist(); render();
    $('#settings-dialog').close();
  } catch (e) { alert('Die Datei ist keine gültige Haushaltsrechner-Sicherung.'); }
}

/* ===== Events ===== */
function bind() {
  $('#month').addEventListener('change', (e) => { if (e.target.value) { state.month = e.target.value; render(); } });
  $('#prev-month').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); render(); });
  $('#next-month').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); render(); });
  $('#copy-prev').addEventListener('click', copyPrevious);

  $('#item-form').addEventListener('submit', (e) => {
    const f = e.target, amount = Format.parse(f.amount.value);
    if (Number.isNaN(amount) || amount < 0) { e.preventDefault(); f.amount.setCustomValidity('Bitte gültigen Betrag eingeben.'); f.amount.reportValidity(); return; }
    const m = curMonth();
    const item = { id: editing.id || newId(), cat: editing.cat, name: f.name.value.trim(), amount,
      owner: f.owner.value, recurring: f.recurring.checked };
    const idx = m.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) m.items[idx] = item; else m.items.push(item);
    persist(); render();
  });
  $('#item-form [name=amount]').addEventListener('input', (e) => e.target.setCustomValidity(''));

  $('#open-settings').addEventListener('click', () => {
    const f = $('#settings-form'), s = state.data.settings;
    f.nameA.value = s.nameA; f.nameB.value = s.nameB; f.split.value = s.split;
    $('#settings-dialog').showModal();
  });
  $('#settings-form').addEventListener('submit', (e) => {
    const f = e.target, s = state.data.settings;
    s.nameA = f.nameA.value.trim() || 'Person A';
    s.nameB = f.nameB.value.trim() || 'Person B';
    s.split = f.split.value;
    persist(); render();
  });
  $('#export-btn').addEventListener('click', exportData);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
}

if (typeof document !== 'undefined') { bind(); render(); }
if (typeof module !== 'undefined') module.exports = { Calc, Format, Store, CATS };
