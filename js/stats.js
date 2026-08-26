import { S } from './state.js';
import { displayRating, earliestVisit } from './data.js';
import { buildHistCurveSvg } from './radar.js';
import {
  PRICE_ESTIMATE, PRICE_RANK, MG_CAFFEINE_PER_CUP,
  EARTH_RADIUS_MILES, EARTH_CIRCUMFERENCE_MILES, MG_CAFFEINE_PER_REDBULL
} from './constants.js';
import { renderVisitHistogram } from './filters.js';

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
    ['s-count','s-avg','s-median','s-stddev','s-range','s-cups','s-caffeine','s-redbulls','s-spent','s-corr','s-beloved','s-distance','s-earthlaps','s-mostvisited']
      .forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('stats-hist').innerHTML = '';
    const emptyFilterHist = document.getElementById('filter-rating-hist');
    if(emptyFilterHist) emptyFilterHist.innerHTML = '';
    return;
  }
  document.getElementById('s-count').textContent = stats.n;
  document.getElementById('s-avg').textContent = stats.avg.toFixed(2);
  document.getElementById('s-median').textContent = stats.median.toFixed(2);
  document.getElementById('s-stddev').textContent = stats.stddev.toFixed(2);
  document.getElementById('s-range').textContent = `${stats.min.toFixed(1)}–${stats.max.toFixed(1)}`;
  const maxBucket = Math.max(1, ...stats.buckets);
  // Stats panel gets the smoothed rating-distribution curve; the filter
  // panel keeps the plain bars above its range slider (a quick preview
  // strip, not the "math" chart) — both still read off stats.buckets so
  // they never drift out of sync with each other.
  document.getElementById('stats-hist').innerHTML = buildHistCurveSvg(stats.buckets, stats.avg);
  const histBarsHtml = stats.buckets.map(c => `<div class="stats-bar" style="height:${Math.max(2,(c/maxBucket)*26)}px" title="${c}"></div>`).join('');
  const filterHist = document.getElementById('filter-rating-hist');
  if(filterHist) filterHist.innerHTML = histBarsHtml;

  const fun = computeFunStats(list);
  document.getElementById('s-cups').textContent = fun.cups;
  document.getElementById('s-caffeine').textContent = fun.caffeineMg >= 1000
    ? (fun.caffeineMg/1000).toFixed(2) + 'g'
    : fun.caffeineMg + 'mg';
  document.getElementById('s-redbulls').textContent = fun.redBulls.toFixed(1) + '×';
  document.getElementById('s-spent').textContent = '~$' + fun.spent.toFixed(0);
  document.getElementById('s-corr').textContent = fun.corr === null
    ? '—' : (fun.corr >= 0 ? '+' : '') + fun.corr.toFixed(2);
  document.getElementById('s-beloved').textContent = fun.mostBeloved
    ? `${fun.mostBeloved.name} (${displayRating(fun.mostBeloved.overall).toFixed(1)})` : '—';
  document.getElementById('s-distance').textContent = fun.distanceMiles > 0
    ? fun.distanceMiles.toFixed(1) + ' mi' : '—';
  document.getElementById('s-earthlaps').textContent = fun.distanceMiles > 0
    ? fun.earthLaps.toFixed(3) : '—';
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
    cups, spent, caffeineMg, corr, mostBeloved, distanceMiles, mostVisited,
    redBulls: caffeineMg / MG_CAFFEINE_PER_REDBULL,
    earthLaps: distanceMiles / EARTH_CIRCUMFERENCE_MILES
  };
}

// Re-renders the stats panel (and visit histogram) with only the shops
// currently on-screen (in the map viewport, passing the active filters) —
// called any time the map pans/zooms or a filter changes.
export function updateInViewStats(){
  const bounds = S.map.getBounds();
  const inView = S.currentVisible.filter(s => bounds.contains([s.lat, s.lng]));
  renderStats(inView);
  renderVisitHistogram(inView);
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
