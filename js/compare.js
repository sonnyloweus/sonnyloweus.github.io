import { S } from './state.js';
import { displayRating } from './data.js';
import { renderCompareRadar } from './radar.js';
import { haversineMiles } from './stats.js';
import { COMPARE_COLOR_A, COMPARE_COLOR_B } from './constants.js';
import { closeOtherSidePanels } from './panel.js';

const compareSearchInput = which => document.getElementById('compare-search-' + which);
const compareSuggEl = which => document.getElementById('compare-suggestions-' + which);

export function hideCompareSuggestions(which){
  const el = compareSuggEl(which);
  el.classList.remove('show');
  el.innerHTML = '';
  el._matches = [];
  el.activeIndex = -1;
}

export function setCompareShop(which, shop, opts){
  opts = opts || {};
  if(which === 'a') S.compareShopA = shop; else S.compareShopB = shop;
  compareSearchInput(which).value = shop ? shop.name : '';
  hideCompareSuggestions(which);
  if(!opts.skipRender) renderCompare();
}

export function renderCompareSuggestions(which, query){
  const el = compareSuggEl(which);
  const other = which === 'a' ? S.compareShopB : S.compareShopA;
  const q = query.trim().toLowerCase();
  let matches = S.GLOBAL_DATA.filter(s => !other || s.name !== other.name);
  if(q){
    matches = matches.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.area && s.area.toLowerCase().includes(q)) ||
      (s.country && s.country.toLowerCase().includes(q))
    );
  }
  matches = matches.sort((x,y) => x.name.localeCompare(y)).slice(0, 8);
  el._matches = matches;
  el.activeIndex = -1;

  if(!matches.length){
    el.innerHTML = '<div class="compare-suggestion-empty">No shops match</div>';
    el.classList.add('show');
    return;
  }

  el.innerHTML = matches.map((s,i) => `<div class="compare-suggestion" data-index="${i}">
      <b>${s.name}</b>
      <span>${[s.area, s.country].filter(Boolean).join(', ')}</span>
    </div>`).join('');
  el.classList.add('show');
  el.querySelectorAll('.compare-suggestion').forEach(row => {
    // mousedown (not click) so this fires before the input's blur handler
    // hides the dropdown out from under it.
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const shop = matches[+row.dataset.index];
      if(shop) setCompareShop(which, shop);
    });
  });
}

export function moveCompareActive(which, delta){
  const el = compareSuggEl(which);
  const rows = el.querySelectorAll('.compare-suggestion');
  if(!rows.length) return;
  const idx = Math.max(0, Math.min(rows.length - 1, (el.activeIndex ?? -1) + delta));
  rows.forEach(r => r.classList.remove('active'));
  rows[idx].classList.add('active');
  rows[idx].scrollIntoView({block:'nearest'});
  el.activeIndex = idx;
}

export function compareRow(label, aVal, bVal, aDisplay, bDisplay){
  const aWin = aVal != null && bVal != null && aVal > bVal;
  const bWin = aVal != null && bVal != null && bVal > aVal;
  return `<div class="compare-row">
    <span class="label">${label}</span>
    <b class="${aWin ? 'winner' : ''}">${aDisplay}</b>
    <b class="${bWin ? 'winner' : ''}">${bDisplay}</b>
  </div>`;
}

export function renderCompare(){
  const a = S.compareShopA, b = S.compareShopB;
  const radarEl = document.getElementById('compare-radar');
  const resultsEl = document.getElementById('compare-results');
  const tagsEl = document.getElementById('compare-tags-shared');
  const distEl = document.getElementById('compare-distance');

  if(!a || !b){
    radarEl.innerHTML = ''; resultsEl.innerHTML = '';
    tagsEl.textContent = ''; distEl.textContent = '';
    S.updateCompareScrollbar();
    return;
  }

  radarEl.innerHTML = renderCompareRadar(a, b);

  const aOverall = displayRating(a.overall), bOverall = displayRating(b.overall);

  // Per-category rows (richness/craft/ambiance/character/value) already
  // live on the radar above — the table below only carries what the
  // radar *can't* show: the combined overall score, price, and visits.
  let html = `<div class="compare-names">
    <span></span>
    <span><span class="compare-name-dot" style="background:${COMPARE_COLOR_A}"></span>${a.name}</span>
    <span><span class="compare-name-dot" style="background:${COMPARE_COLOR_B}"></span>${b.name}</span>
  </div>`;
  html += compareRow('Overall', a.overall, b.overall, aOverall.toFixed(1), bOverall.toFixed(1));
  html += compareRow('Price', null, null, a.price || '—', b.price || '—');

  const visitsA = (a.visited && a.visited.length) || 0;
  const visitsB = (b.visited && b.visited.length) || 0;
  html += compareRow('Visits', visitsA, visitsB, visitsA || '—', visitsB || '—');

  resultsEl.innerHTML = html;

  const tagsA = new Set(a.tags || []), tagsB = new Set(b.tags || []);
  const shared = [...tagsA].filter(t => tagsB.has(t));
  tagsEl.innerHTML = shared.length
    ? `Both: <b>${shared.join(', ')}</b>`
    : (tagsA.size && tagsB.size ? 'No tags in common — total opposites' : '');

  if(a.lat != null && a.lng != null && b.lat != null && b.lng != null){
    const miles = haversineMiles(a.lat, a.lng, b.lat, b.lng);
    distEl.innerHTML = miles < 0.5
      ? 'Practically next door'
      : `<b>${miles.toFixed(miles < 10 ? 1 : 0)} mi</b> apart`;
  }else{
    distEl.textContent = '';
  }

  S.updateCompareScrollbar();
}

// ---- Wires up the compare card: the a/b search inputs (focus/input/blur/
// keydown), the initial matchup (first two shops alphabetically), and the
// toggle-compare card open/close button. Called once from map.js's
// initApp(), after S.GLOBAL_DATA is populated. ----
export function setupCompare(){
  ['a','b'].forEach(which => {
    const input = compareSearchInput(which);
    input.addEventListener('focus', () => renderCompareSuggestions(which, input.value));
    input.addEventListener('input', () => renderCompareSuggestions(which, input.value));
    input.addEventListener('blur', () => hideCompareSuggestions(which));
    input.addEventListener('keydown', (e) => {
      const el = compareSuggEl(which);
      if(e.key === 'ArrowDown'){ e.preventDefault(); moveCompareActive(which, 1); }
      else if(e.key === 'ArrowUp'){ e.preventDefault(); moveCompareActive(which, -1); }
      else if(e.key === 'Enter'){
        e.preventDefault();
        const matches = el._matches || [];
        const idx = el.activeIndex >= 0 ? el.activeIndex : 0;
        if(matches[idx]) setCompareShop(which, matches[idx]);
      }else if(e.key === 'Escape'){
        hideCompareSuggestions(which);
        input.blur();
      }
    });
  });

  // Initial matchup: the first two shops alphabetically.
  (function initCompare(){
    const sortedNames = [...S.GLOBAL_DATA].map(s => s.name).sort((x,y) => x.localeCompare(y));
    const initialA = sortedNames.length ? S.GLOBAL_DATA.find(s => s.name === sortedNames[0]) : null;
    const initialB = sortedNames.length > 1 ? S.GLOBAL_DATA.find(s => s.name === sortedNames[1]) : null;
    if(initialA) setCompareShop('a', initialA, {skipRender:true});
    if(initialB) setCompareShop('b', initialB, {skipRender:true});
    renderCompare();
  })();

  document.getElementById('toggle-compare').onclick = (e) => {
    const card = document.getElementById('compare-card');
    const opening = !card.classList.contains('show');
    closeOtherSidePanels('compare-card');
    card.classList.toggle('show', opening);
    e.currentTarget.classList.toggle('on', opening);
  };
}
