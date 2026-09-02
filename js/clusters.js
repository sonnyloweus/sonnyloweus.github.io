/* global d3 */
// Taste-space clustering for the stats panel's "Taste clusters" section —
// groups every shop in the full dataset by its 5 rating axes (richness,
// craft, ambiance, character, value) using k-means, then projects that
// same 5-D space down to 2-D with PCA so the grouping is visible as a
// scatter plot. Geography and the current map viewport play no part in
// this — it's the same taste-only clustering prototyped against the real
// dataset in the sandbox, just folded into the site itself.
//
// Computed once per page load (computeClusters(), called from map.js right
// after the data loads) and cached on S.clusters — nothing about the
// viewport, filters, or date range changes what "belongs together" in
// taste-space, so there's no reason to ever recompute it after that.
import { S } from './state.js';
import { CATEGORY_ORDER } from './constants.js';

const AXES = CATEGORY_ORDER; // ['richness','craft','ambiance','character','value']
const AXIS_LABEL = {
  richness: 'Rich & bold', craft: 'Craft-obsessed', ambiance: 'Ambiance-first',
  character: 'Full of character', value: 'Best value'
};
// Same 8-hue categorical set the sandbox prototype used — ordered for
// adjacent-pair colorblind-safety, deliberately *not* matching the
// coffee-brown site palette, since it needs to read as an added-on system
// next to the tier gradient, not a variant of it.
export const CLUSTER_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

function dist2(a, b){ let s = 0; for(let i = 0; i < a.length; i++){ const d = a[i]-b[i]; s += d*d; } return s; }

// Deterministic PRNG (not Math.random) so the same dataset always resolves
// to the same clustering across page loads instead of the legend/plot
// silently reshuffling itself on every refresh.
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standardize(rows, keys){
  const means = {}, stds = {};
  keys.forEach(k => {
    const vals = rows.map(r => r.ratings[k]);
    const m = d3.mean(vals); const sd = Math.sqrt(d3.mean(vals.map(v => (v-m)**2))) || 1;
    means[k] = m; stds[k] = sd;
  });
  return rows.map(r => keys.map(k => (r.ratings[k]-means[k])/stds[k]));
}

function kmeansOnce(points, k, rng){
  const n = points.length, dim = points[0].length;
  // k-means++ init
  const centroids = [points[Math.floor(rng()*n)]];
  while(centroids.length < k){
    const d2 = points.map(p => Math.min(...centroids.map(c => dist2(p, c))));
    const sum = d3.sum(d2); let r = rng()*sum, idx = 0;
    for(; idx < n; idx++){ r -= d2[idx]; if(r <= 0) break; }
    centroids.push(points[Math.min(idx, n-1)]);
  }
  let assign = new Array(n).fill(-1);
  for(let iter = 0; iter < 100; iter++){
    let changed = false;
    const newAssign = points.map(p => {
      let best = 0, bestD = Infinity;
      centroids.forEach((c, ci) => { const d = dist2(p, c); if(d < bestD){ bestD = d; best = ci; } });
      return best;
    });
    for(let i = 0; i < n; i++) if(newAssign[i] !== assign[i]) changed = true;
    assign = newAssign;
    for(let ci = 0; ci < k; ci++){
      const members = points.filter((_, i) => assign[i] === ci);
      if(!members.length) continue;
      centroids[ci] = Array.from({length: dim}, (_, d) => d3.mean(members, m => m[d]));
    }
    if(!changed) break;
  }
  const inertia = d3.sum(points.map((p, i) => dist2(p, centroids[assign[i]])));
  return {assign, centroids, inertia};
}
function kmeans(points, k, seed, restarts){
  const rng = mulberry32(seed);
  let best = null;
  for(let r = 0; r < restarts; r++){
    const res = kmeansOnce(points, k, rng);
    if(!best || res.inertia < best.inertia) best = res;
  }
  return best;
}

// PCA via power iteration + deflation on the 5x5 covariance matrix — no
// linear-algebra library needed for just the top two components.
function covariance(points){
  const dim = points[0].length, n = points.length;
  const C = Array.from({length: dim}, () => new Array(dim).fill(0));
  for(let i = 0; i < n; i++) for(let a = 0; a < dim; a++) for(let b = 0; b < dim; b++) C[a][b] += points[i][a]*points[i][b]/n;
  return C;
}
function matVec(M, v){ return M.map(row => d3.sum(row.map((x, i) => x*v[i]))); }
function vecNorm(v){ return Math.sqrt(d3.sum(v.map(x => x*x))); }
function powerIteration(M, dim, iters){
  let v = new Array(dim).fill(0).map((_, i) => i === 0 ? 1 : 0.3);
  for(let t = 0; t < iters; t++){ v = matVec(M, v); const nrm = vecNorm(v) || 1; v = v.map(x => x/nrm); }
  const lambda = d3.sum(matVec(M, v).map((x, i) => x*v[i]));
  return {vec: v, val: lambda};
}
function pca2(points){
  const dim = points[0].length;
  const C = covariance(points);
  const pc1 = powerIteration(C, dim, 300);
  const C2 = C.map((row, a) => row.map((x, b) => x - pc1.val*pc1.vec[a]*pc1.vec[b]));
  const pc2raw = powerIteration(C2, dim, 300);
  const val2 = d3.sum(matVec(C, pc2raw.vec).map((x, i) => x*pc2raw.vec[i]));
  const totalVar = d3.sum(d3.range(dim).map(i => C[i][i]));
  const scores = points.map(p => [
    d3.sum(p.map((x, i) => x*pc1.vec[i])),
    d3.sum(p.map((x, i) => x*pc2raw.vec[i]))
  ]);
  return {scores, var1: pc1.val/totalVar, var2: val2/totalVar};
}

// Names a cluster after its most distinctive axis (highest mean z-score
// among its members); falls back to naming the top two when nothing
// stands out, so two mild clusters don't collide on the same label.
function clusterLabel(members, Z){
  const meanZ = AXES.map((_, ax) => d3.mean(members, m => Z[m.idx][ax]));
  const order = AXES.map((a, i) => i).sort((a, b) => meanZ[b]-meanZ[a]);
  const top = order[0];
  if(meanZ[top] < 0.15) return `${AXIS_LABEL[AXES[top]]} / ${AXIS_LABEL[AXES[order[1]]]}`;
  return AXIS_LABEL[AXES[top]];
}

// Fixed at k=4 rather than auto-picked — small enough to stay readable
// in a card this size, big enough to say something about 5 rating axes.
const CLUSTER_K = 4;

export function computeClusters(){
  const shops = S.GLOBAL_DATA;
  if(!shops || shops.length < 6){ S.clusters = null; return; }
  const withIdx = shops.map((s, i) => ({...s, idx: i}));
  const Z = standardize(withIdx, AXES);

  const bestK = Math.min(CLUSTER_K, withIdx.length);
  const bestResult = kmeans(Z, bestK, 42, 10);

  const {scores, var1, var2} = pca2(Z);
  const clusters = [];
  for(let ci = 0; ci < bestK; ci++){
    const members = withIdx.filter((_, i) => bestResult.assign[i] === ci);
    if(!members.length) continue;
    clusters.push({
      ci, members,
      label: clusterLabel(members, Z),
      avgOverall: d3.mean(members, m => m.overall),
      color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length]
    });
  }
  S.clusters = {k: bestK, assign: bestResult.assign, scores, var1, var2, clusters};
}

function highlightCluster(ci){
  document.querySelectorAll('#clusters-legend .cluster-chip').forEach(el => {
    el.classList.toggle('dim', ci !== null && +el.dataset.cluster !== ci);
  });
  document.querySelectorAll('#clusters-pca-svg .cluster-dot').forEach(el => {
    el.setAttribute('fill-opacity', (ci === null || +el.dataset.cluster === ci) ? '0.85' : '0.15');
  });
}

// Draws the PCA scatter (plain SVG string, same convention as radar.js/
// floating-plots.js — no d3 DOM selections) and the cluster legend chips
// into the stats panel. Called once, right after computeClusters() —
// nothing here depends on the current map viewport or filters.
export function renderClusters(){
  const svgEl = document.getElementById('clusters-pca-svg');
  const legendEl = document.getElementById('clusters-legend');
  const captionEl = document.getElementById('clusters-caption');
  const sectionEl = document.getElementById('clusters-section');
  if(!svgEl || !legendEl || !sectionEl) return;
  if(!S.clusters){ sectionEl.style.display = 'none'; return; }
  sectionEl.style.display = '';

  const {scores, clusters, assign, var1, var2} = S.clusters;
  // Square-ish (was a long flat strip) so the two axes read at comparable
  // scale instead of PC1 looking artificially stretched next to PC2.
  const W = 320, H = 200, pad = 22;
  const xs = scores.map(p => p[0]), ys = scores.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const spanX = Math.max(1e-6, x1-x0), spanY = Math.max(1e-6, y1-y0);
  const xOf = v => pad + ((v-x0)/spanX) * (W - pad*2);
  const yOf = v => (H-pad) - ((v-y0)/spanY) * (H - pad*2);

  // PCA scores are always mean-centered at (0,0) by construction, so the
  // origin doubles as a natural pair of axis lines through the middle of
  // the cloud rather than a plot-edge axis box.
  const originX = xOf(0), originY = yOf(0);
  const axes = `
    <line class="cluster-axis-line" x1="${pad}" x2="${W-pad}" y1="${originY.toFixed(1)}" y2="${originY.toFixed(1)}"/>
    <line class="cluster-axis-line" x1="${originX.toFixed(1)}" x2="${originX.toFixed(1)}" y1="${pad}" y2="${H-pad}"/>
    <text class="cluster-axis-label" x="${W-pad}" y="${(originY-6).toFixed(1)}" text-anchor="end">PC1 &#8594;</text>
    <text class="cluster-axis-label" x="${(originX+6).toFixed(1)}" y="${pad+7}">&#8593; PC2</text>
  `;
  const colorOf = ci => (clusters.find(c => c.ci === ci) || {}).color || '#8C8579';
  const dots = scores.map((p, i) => (
    `<circle class="cluster-dot" data-cluster="${assign[i]}" cx="${xOf(p[0]).toFixed(1)}" cy="${yOf(p[1]).toFixed(1)}" r="3.6" fill="${colorOf(assign[i])}" fill-opacity="0.85"/>`
  )).join('');
  svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgEl.innerHTML = axes + dots;

  if(captionEl) captionEl.textContent = `k=${S.clusters.k}`;

  const descEl = document.getElementById('clusters-desc');
  if(descEl){
    descEl.textContent = `k-means over your 5 rating axes, grouped into ${S.clusters.k}. Dots are PC1×PC2 of that space (${Math.round((var1+var2)*100)}% of variance) — geography plays no part.`;
  }

  legendEl.innerHTML = clusters.map(c => (
    `<div class="cluster-chip" data-cluster="${c.ci}" title="avg overall ${c.avgOverall.toFixed(1)}">
      <span class="cluster-dot-swatch" style="background:${c.color}"></span>
      <span class="cluster-chip-label">${c.label}</span>
      <span class="cluster-chip-n">${c.members.length}</span>
    </div>`
  )).join('');
  legendEl.querySelectorAll('.cluster-chip').forEach(chip => {
    chip.addEventListener('mouseenter', () => highlightCluster(+chip.dataset.cluster));
    chip.addEventListener('mouseleave', () => highlightCluster(null));
  });
}
