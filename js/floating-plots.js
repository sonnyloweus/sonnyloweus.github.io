// Floating, frameless distribution plots that sit directly on the map
// surface below the brand bar — no card, no border, no fill behind them.
// Each one is a small smoothed-curve histogram (same construction as the
// stats panel's curve) but always drawn in translucent black ink instead
// of the active rating palette, since these read as marks made on top of
// the map itself rather than UI chrome.
import { smoothOpenPath } from './radar.js';
import { S } from './state.js';

const AXES = [
  { key: 'richness',  label: 'richness',  get: s => s.ratings && s.ratings.richness },
  { key: 'craft',     label: 'craft',     get: s => s.ratings && s.ratings.craft },
];

function bucketsFor(vals){
  const buckets = new Array(10).fill(0); // half-point bins, 0–0.5 … 4.5–5
  vals.forEach(v => buckets[Math.min(9, Math.max(0, Math.floor(v * 2)))]++);
  const n = vals.length;
  const avg = n ? vals.reduce((a, b) => a + b, 0) / n : 0;
  return { buckets, avg, n };
}

// Bucket *counts* only make sense on their own axis — 1 shop concentrated
// in one bin should look exactly as "peaked" as 20 shops concentrated in
// one bin. Converting to a fraction-of-sample before drawing is what makes
// a single-pin view (or any small in-view sample) read as a proper spike
// instead of a near-flat line squashed by a much larger comparison sample.
function fractionsFor(buckets, n){
  return n ? buckets.map(c => c / n) : buckets.map(() => 0);
}

function buildInkCurveSvg(buckets){
  const maxBucket = Math.max(1, ...buckets);
  const centers = buckets.map((c, i) => (i + 0.5) * 0.5);
  const W = 172, H = 30;
  const xOf = v => (v / 5) * W;
  const yOf = c => H - (c / maxBucket) * (H - 4) - 2;

  const pts = [
    [xOf(0), yOf(0.0001)],
    ...centers.map((c, i) => [xOf(c), yOf(Math.max(buckets[i], 0.0001))]),
    [xOf(5), yOf(0.0001)],
  ];
  const linePath = smoothOpenPath(pts, 0.65);
  const areaPath = linePath + ` L ${xOf(5)},${H} L ${xOf(0)},${H} Z`;

  // Shade only — no stroked outline, no average marker. Kept as quiet as
  // possible: the filled shape alone is the whole plot.
  return `<svg viewBox="0 0 ${W} ${H + 12}" preserveAspectRatio="none">
    <path d="${areaPath}" fill="rgba(0,0,0,0.24)"/>
    <text x="${xOf(0)}" y="${H + 11}" class="floatplot-axis-label">0</text>
    <text x="${xOf(5)}" y="${H + 11}" text-anchor="end" class="floatplot-axis-label">5</text>
  </svg>`;
}

// --- local vs. global — any curve, but with a second faint dashed outline
// drawn behind it showing the distribution across the WHOLE dataset, not
// just what's in view. Lets you see at a glance whether this neighborhood
// skews above or below your average taste, instead of only ever seeing the
// local shape in isolation. Cached per-axis since it never changes after
// the data loads. ---
const globalBucketsCache = {};
function getGlobalBuckets(key, getter){
  if (globalBucketsCache[key] !== undefined) return globalBucketsCache[key];
  if (!Array.isArray(S.GLOBAL_DATA) || !S.GLOBAL_DATA.length){
    return null; // data not loaded yet — don't cache a miss permanently
  }
  const vals = S.GLOBAL_DATA.map(getter).filter(v => typeof v === 'number' && !isNaN(v));
  const result = vals.length ? bucketsFor(vals) : null;
  globalBucketsCache[key] = result;
  return result;
}

// Both curves are drawn from their own fraction-of-sample, then scaled
// together against whichever curve has the tallest single bin. That way a
// tiny in-view sample (even n=1) still reaches full height when it's
// concentrated in one bin, rather than being dwarfed by the much larger
// global sample's raw counts.
function buildOverlayCurveSvg(localFractions, globalFractions){
  const maxFrac = Math.max(1e-6, ...localFractions, ...globalFractions);
  const centers = localFractions.map((c, i) => (i + 0.5) * 0.5);
  const W = 172, H = 30;
  const xOf = v => (v / 5) * W;
  const yOf = c => H - (c / maxFrac) * (H - 4) - 2;
  const pathFor = fractions => smoothOpenPath(
    [[xOf(0), yOf(0.0001)], ...centers.map((c, i) => [xOf(c), yOf(Math.max(fractions[i], 0.0001))]), [xOf(5), yOf(0.0001)]],
    0.65
  );
  const localPath = pathFor(localFractions);
  const localArea = localPath + ` L ${xOf(5)},${H} L ${xOf(0)},${H} Z`;
  const globalPath = pathFor(globalFractions);
  return `<svg viewBox="0 0 ${W} ${H + 12}" preserveAspectRatio="none">
    <path d="${globalPath}" fill="none" stroke="rgba(21,18,16,0.32)" stroke-width="1" stroke-dasharray="2,3"/>
    <path d="${localArea}" fill="rgba(0,0,0,0.24)"/>
    <text x="${xOf(0)}" y="${H + 11}" class="floatplot-axis-label">0</text>
    <text x="${xOf(5)}" y="${H + 11}" text-anchor="end" class="floatplot-axis-label">5</text>
  </svg>`;
}

function curveFor(vals, key, getter){
  const { buckets: localBuckets, n: localN } = bucketsFor(vals);
  const global = getGlobalBuckets(key, getter);
  if (!global) return buildInkCurveSvg(localBuckets);
  const localFractions = fractionsFor(localBuckets, localN);
  const globalFractions = fractionsFor(global.buckets, global.n);
  return buildOverlayCurveSvg(localFractions, globalFractions);
}

let lastSig = '';
export function renderFloatingPlots(list){
  const root = document.getElementById('floating-plots');
  if(!root) return;
  if(!list || !list.length){ root.innerHTML = ''; lastSig = ''; return; }

  const sig = list.length + ':' + list.map(s => s.name || s.id).sort().join(',');
  if (sig === lastSig) return;
  lastSig = sig;

  const overallVals = list.map(s => s.overall).filter(v => typeof v === 'number' && !isNaN(v));
  let overall = '';
  if (overallVals.length){
    overall = `<div class="floatplot">
      <div class="floatplot-label">overall (vs. all)</div>
      <div class="floatplot-curve">${curveFor(overallVals, 'overall', s => s.overall)}</div>
    </div>`;
  }

  const curves = AXES.map(axis => {
    const vals = list.map(axis.get).filter(v => typeof v === 'number' && !isNaN(v));
    if (!vals.length) return '';
    return `<div class="floatplot">
      <div class="floatplot-label">${axis.label}</div>
      <div class="floatplot-curve">${curveFor(vals, axis.key, axis.get)}</div>
    </div>`;
  }).join('');

  root.innerHTML = overall + curves;
}
