import { S } from './state.js';
import { displayRating, earliestVisit } from './data.js';
import {
  PRICE_ESTIMATE, PRICE_RANK, MG_CAFFEINE_PER_CUP,
  EARTH_RADIUS_MILES
} from './constants.js';
import { renderVisitHistogram } from './filters.js';
import { renderFloatingPlots } from './floating-plots.js';
import { renderClusters } from './clusters.js';

// ---------- stats ----------
export function computeStats(list){
  const n = list.length;
  if(n === 0) return null;
  const vals = list.map(s => displayRating(s.overall));
  const avg = vals.reduce((a,b)=>a+b,0) / n;
  const sorted = [...vals].sort((a,b)=>a-b);
  const median = n % 2 ? sorted[(n-1)/2] : (sorted[n/2-1] + sorted[n/2]) / 2;
  const variance = vals.reduce((s,v)=>s+(v-avg)**2, 0) / n;
  const stddev = Math.sqrt(variance);
  const min = sorted[0], max = sorted[n-1];
  const buckets = new Array(10).fill(0); // half-point bins: 0–0.5, 0.5–1, ... 4.5–5
  vals.forEach(v => buckets[Math.min(9, Math.max(0, Math.floor(v * 2)))]++);
  return {n, avg, median, stddev, min, max, buckets};
}

// Swaps the "N in view · avg" readout in the title bar for a spinner —
// used whenever that count is about to be stale for a noticeable stretch
// (the initial coffee.json fetch, and the staggered marker pop-in that
// follows it). renderStats() below always re-sets #count's textContent once
// real numbers are ready, which naturally clears the spinner back out.
export function showCountSpinner(){
  const countEl = document.getElementById('count');
  if(countEl) countEl.innerHTML = '<span class="count-spinner" aria-hidden="true"></span>';
}

export function renderStats(list){
  const stats = computeStats(list);
  // No leading "· " here anymore — that separator now lives in its own
  // .brand-gap element between the title and this count (see the HTML),
  // so it can be centered in the gap on mobile instead of glued to the
  // front of this text.
  document.getElementById('count').textContent = stats ? `${stats.n} in view ${stats.avg.toFixed(1)} avg` : '0 in view';
  if(!stats){
    ['s-count','s-avg','s-median','s-stddev','s-range','s-cups','s-caffeine','s-spent','s-corr','s-beloved','s-distance','s-mostvisited']
      .forEach(id => document.getElementById(id).textContent = '—');
    const emptyFilterHist = document.getElementById('filter-rating-hist');
    if(emptyFilterHist) emptyFilterHist.innerHTML = '';
    const emptyHalo = document.getElementById('halo-bars');
    if(emptyHalo) emptyHalo.innerHTML = '';
    return;
  }
  document.getElementById('s-count').textContent = stats.n;
  document.getElementById('s-avg').textContent = stats.avg.toFixed(2);
  document.getElementById('s-median').textContent = stats.median.toFixed(2);
  document.getElementById('s-stddev').textContent = stats.stddev.toFixed(2);
  document.getElementById('s-range').textContent = `${stats.min.toFixed(1)}–${stats.max.toFixed(1)}`;
  const maxBucket = Math.max(1, ...stats.buckets);
  // The stats panel used to also show a smoothed rating-distribution curve
  // here (buildHistCurveSvg, radar.js) — dropped now that the same
  // distribution is already visible on the map itself via the floating
  // plots. The filter panel keeps its own plain-bars preview below, still
  // read off this same stats.buckets so the two never drift out of sync.
  const histBarsHtml = stats.buckets.map(c => `<div class="stats-bar" style="height:${Math.max(2,(c/maxBucket)*26)}px" title="${c}"></div>`).join('');
  const filterHist = document.getElementById('filter-rating-hist');
  if(filterHist) filterHist.innerHTML = histBarsHtml;

  const haloStats = computeHaloStats(list);
  const haloBars = document.getElementById('halo-bars');
  if(haloBars) haloBars.innerHTML = renderHaloBars(haloStats);

  const fun = computeFunStats(list);
  document.getElementById('s-cups').textContent = fun.cups;
  document.getElementById('s-caffeine').textContent = fun.caffeineMg >= 1000
    ? (fun.caffeineMg/1000).toFixed(2) + 'g'
    : fun.caffeineMg + 'mg';
  document.getElementById('s-spent').textContent = '~$' + fun.spent.toFixed(0);
  document.getElementById('s-corr').textContent = fun.corr === null
    ? '—' : (fun.corr >= 0 ? '+' : '') + fun.corr.toFixed(2);
  document.getElementById('s-beloved').textContent = fun.mostBeloved
    ? `${fun.mostBeloved.name} (${displayRating(fun.mostBeloved.overall).toFixed(1)})` : '—';
  document.getElementById('s-distance').textContent = fun.distanceMiles > 0
    ? fun.distanceMiles.toFixed(1) + ' mi' : '—';
  document.getElementById('s-mostvisited').textContent = fun.mostVisited
    ? `${fun.mostVisited.name} (×${fun.mostVisited.count})` : '—';
}

export function haversineMiles(lat1, lng1, lat2, lng2){
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function pearsonCorrelation(xs, ys){
  const n = xs.length;
  if(n < 2) return null;
  const mx = xs.reduce((a,b) => a+b, 0) / n;
  const my = ys.reduce((a,b) => a+b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for(let i = 0; i < n; i++){
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  if(dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

// ---- Halo effect: does the *experience* color how rich the coffee tastes? ----
// richness is the one axis that's actually about what's in the cup; craft,
// ambiance, character and value are all things you register before/without
// tasting anything, so correlating each of them against richness (across
// whatever's currently in view) is a rough read on how much the room, the
// theater, and the price are doing the coffee's job for it.
const HALO_FACTORS = [
  {key:'craft', label:'Craft'},
  {key:'ambiance', label:'Ambiance'},
  {key:'character', label:'Character'},
  {key:'value', label:'Value'}
];

export function computeHaloStats(list){
  return HALO_FACTORS.map(({key,label}) => {
    const xs = [], ys = [];
    list.forEach(shop => {
      const r = shop.ratings;
      if(r && typeof r[key] === 'number' && typeof r.richness === 'number'){
        xs.push(r[key]); ys.push(r.richness);
      }
    });
    return {key, label, n: xs.length, corr: pearsonCorrelation(xs, ys)};
  });
}

// Diverging horizontal bars, one per non-coffee factor, on a shared -1..1
// scale centered at 0 — mirrors the price↔rating single stat above but
// laid out so three correlations can be compared by eye at once. Bars
// growing right (positive) mean richness rides up with that factor; bars
// growing left (negative) mean the opposite.
export function renderHaloBars(haloStats){
  return haloStats.map(({label, n, corr}) => {
    const v = corr === null ? 0 : Math.max(-1, Math.min(1, corr));
    const leftPct = 50 + Math.min(0, v) * 50;
    const widthPct = Math.abs(v) * 50;
    const valText = corr === null ? '—' : (corr >= 0 ? '+' : '') + corr.toFixed(2);
    const fillClass = v < 0 ? 'halo-fill neg' : 'halo-fill';
    return `<div class="halo-row">
      <div class="halo-label">${label}</div>
      <div class="halo-track">
        <div class="halo-center"></div>
        <div class="${fillClass}" style="left:${leftPct}%; width:${widthPct}%;"></div>
      </div>
      <div class="halo-val">${valText}</div>
    </div>`;
  }).join('');
}

export function computeFunStats(list){
  let cups = 0, spent = 0;
  list.forEach(shop => {
    const visits = (shop.visited && shop.visited.length) ? shop.visited.length : 1;
    cups += visits;
    spent += (PRICE_ESTIMATE[shop.price] || 5) * visits;
  });

  // price vs. rating — does paying more actually track with how you rate a place?
  const priceXs = [], ratingYs = [];
  list.forEach(shop => {
    if(PRICE_RANK[shop.price] !== undefined){
      priceXs.push(PRICE_RANK[shop.price]);
      ratingYs.push(shop.overall);
    }
  });
  const corr = pearsonCorrelation(priceXs, ratingYs);

  // your highest-rated spot in the current view
  let mostBeloved = null;
  list.forEach(shop => {
    if(!mostBeloved || shop.overall > mostBeloved.overall){ mostBeloved = shop; }
  });

  // total real-world distance covered between visits, in chronological order
  const chronological = list
    .filter(s => earliestVisit(s) !== null)
    .sort((a,b) => earliestVisit(a) - earliestVisit(b));
  let distanceMiles = 0;
  for(let i = 1; i < chronological.length; i++){
    distanceMiles += haversineMiles(
      chronological[i-1].lat, chronological[i-1].lng,
      chronological[i].lat, chronological[i].lng
    );
  }

  // most-returned-to spot
  let mostVisited = null;
  list.forEach(shop => {
    const count = (shop.visited && shop.visited.length) || 1;
    if(!mostVisited || count > mostVisited.count){ mostVisited = { name: shop.name, count }; }
  });
  if(mostVisited && mostVisited.count <= 1) mostVisited = null;

  const caffeineMg = cups * MG_CAFFEINE_PER_CUP;
  return {
    cups, spent, caffeineMg, corr, mostBeloved, distanceMiles, mostVisited
  };
}

// Shops in view use their canonical lng, but the map itself may be
// panned into a repeated ("mirrored") copy of the world — Leaflet's
// worldCopyJump is deliberately off (see map.js) so panning is
// continuous rather than snapping back. bounds.contains() alone can't
// see that: once the view bounds shift by a multiple of 360° into a
// repeated copy, a shop's canonical longitude no longer falls inside
// them even though it's visibly on screen via its mirror marker. This
// checks the shop's longitude shifted into whichever repeated world is
// nearest the bounds' center (plus one world on each side, in case the
// view is wide) before testing containment.
function shopInBounds(bounds, lat, lng){
  if(lat < bounds.getSouth() || lat > bounds.getNorth()) return false;
  const west = bounds.getWest(), east = bounds.getEast();
  const base = Math.round((bounds.getCenter().lng - lng) / 360);
  for(let k = base - 1; k <= base + 1; k++){
    const cand = lng + k * 360;
    if(cand >= west && cand <= east) return true;
  }
  return false;
}

// Re-renders the stats panel (and visit histogram) with only the shops
// currently on-screen (in the map viewport, passing the active filters) —
// called any time the map pans/zooms or a filter changes.
export function updateInViewStats(){
  const bounds = S.map.getBounds();
  const inView = S.currentVisible.filter(s => shopInBounds(bounds, s.lat, s.lng));
  renderStats(inView);
  renderVisitHistogram(inView);
  renderFloatingPlots(inView);
  if(S.clusters) renderClusters(inView); // gray out taste-cluster dots for shops panned/filtered out of view
  S.updateStatsScrollbar();
}

// ---- On this day: surface any past visit that lands on today's month/day ----
export function showOnThisDay(data){
  const today = new Date();
  const todayM = today.getMonth(), todayD = today.getDate(), todayY = today.getFullYear();
  const matches = [];
  data.forEach(shop => {
    (shop.visited || []).forEach(dateStr => {
      const d = new Date(dateStr);
      if(isNaN(d)) return;
      if(d.getMonth() === todayM && d.getDate() === todayD && d.getFullYear() < todayY){
        const yearsAgo = todayY - d.getFullYear();
        matches.push({yearsAgo, text: `${yearsAgo} year${yearsAgo === 1 ? '' : 's'} ago today: ${shop.name}`});
      }
    });
  });
  if(!matches.length) return;
  matches.sort((a,b) => a.yearsAgo - b.yearsAgo); // most recent first, however many years back
  document.getElementById('onthisday-text').textContent = matches.map(m => m.text).join('  ·  ');
  document.getElementById('onthisday-banner').style.display = 'flex';
}
