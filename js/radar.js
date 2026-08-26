import { CATEGORY_ORDER, RADIUS_BREAKPOINTS, COMPARE_COLOR_A, COMPARE_COLOR_B } from './constants.js';

export function polarPoint(cx, cy, radius, angleDeg){
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)];
}

export function smoothClosedPath(pts, tension){
  tension = tension === undefined ? 0.55 : tension;
  const n = pts.length;
  const p = i => pts[(i+n)%n];
  let d = `M ${p(0)[0]},${p(0)[1]} `;
  for(let i=0;i<n;i++){
    const p0=p(i-1), p1=p(i), p2=p(i+1), p3=p(i+2);
    const c1 = [p1[0] + (p2[0]-p0[0])/6*tension, p1[1] + (p2[1]-p0[1])/6*tension];
    const c2 = [p2[0] - (p3[0]-p1[0])/6*tension, p2[1] - (p3[1]-p1[1])/6*tension];
    d += `C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]} `;
  }
  return d + 'Z';
}

// Same catmull-rom -> cubic-bezier smoothing as smoothClosedPath above, but
// for an *open* polyline (a line chart rather than a closed blob) — used by
// the stats panel's rating-distribution curve.
export function smoothOpenPath(pts, tension){
  tension = tension === undefined ? 0.55 : tension;
  const p = i => pts[Math.max(0, Math.min(pts.length-1, i))];
  let d = `M ${p(0)[0]},${p(0)[1]} `;
  for(let i=0;i<pts.length-1;i++){
    const p0=p(i-1), p1=p(i), p2=p(i+1), p3=p(i+2);
    const c1 = [p1[0] + (p2[0]-p0[0])/6*tension, p1[1] + (p2[1]-p0[1])/6*tension];
    const c2 = [p2[0] - (p3[0]-p1[0])/6*tension, p2[1] - (p3[1]-p1[1])/6*tension];
    d += `C ${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]} `;
  }
  return d.trim();
}

// Builds the smoothed-line "rating distribution" chart for the stats panel
// (replaces the old bar histogram there — the filter panel keeps its bars,
// rendered separately in renderStats below). buckets are the same 10
// half-point bins computeStats already produces; avg comes straight off
// the same stats object so the dashed guide always matches the Average row.
export function buildHistCurveSvg(buckets, avg){
  const maxBucket = Math.max(1, ...buckets);
  const centers = buckets.map((c,i) => (i + 0.5) * 0.5);
  const W = 188, H = 30; // curve drawing area; axis sits just below it
  const xOf = v => (v/5) * W;
  const yOf = c => H - (c/maxBucket) * (H-4) - 2;

  // Zero-height anchor points at 0 and 5 so the curve tapers down to the
  // axis at both ends instead of getting clipped mid-slope.
  const pts = [[xOf(0), yOf(0.0001)], ...centers.map((c,i) => [xOf(c), yOf(Math.max(buckets[i], 0.0001))]), [xOf(5), yOf(0.0001)]];
  const linePath = smoothOpenPath(pts, 0.65);
  const areaPath = linePath + ` L ${xOf(5)},${H} L ${xOf(0)},${H} Z`;

  const peakIdx = buckets.indexOf(Math.max(...buckets));
  const peakCenter = centers[peakIdx];
  const avgX = xOf(Math.max(0, Math.min(5, avg)));
  const axisY = H + 12;

  return `<svg viewBox="0 0 ${W} ${H+14}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="hist-curve-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--tier-3)" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="var(--tier-3)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#hist-curve-fill)"/>
    <path d="${linePath}" fill="none" stroke="var(--tier-6)" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="${avgX}" y1="0" x2="${avgX}" y2="${H}" stroke="var(--accent)" stroke-width="1" stroke-dasharray="2,2" opacity="0.55"/>
    <circle cx="${xOf(peakCenter)}" cy="${yOf(buckets[peakIdx])}" r="2.4" fill="var(--accent)"/>
    <line x1="${xOf(0)}" y1="${H}" x2="${xOf(0)}" y2="${H+3}" stroke="var(--line)" stroke-width="1"/>
    <line x1="${xOf(2.5)}" y1="${H}" x2="${xOf(2.5)}" y2="${H+3}" stroke="var(--line)" stroke-width="1"/>
    <line x1="${xOf(5)}" y1="${H}" x2="${xOf(5)}" y2="${H+3}" stroke="var(--line)" stroke-width="1"/>
    <text x="${xOf(0)}" y="${axisY}" class="stats-axis-label">0</text>
    <text x="${xOf(2.5)}" y="${axisY}" text-anchor="middle" class="stats-axis-label">2.5</text>
    <text x="${xOf(5)}" y="${axisY}" text-anchor="end" class="stats-axis-label">5</text>
  </svg>`;
}

// A point-by-point directional stretch: only the component of each point
// *along* the cast-shadow axis is scaled and pushed out; the perpendicular
// component is untouched. Because this is a plain linear map, two shapes
// that genuinely overlap before the transform still overlap after — which
// is what keeps the handle's shadow fused to the rim's shadow instead of
// drifting into a separate floating blob.
export function stretchPoint(px, py, cx, cy, dirx, diry, stretch, dist){
  const vx = px-cx, vy = py-cy;
  const along = vx*dirx + vy*diry;
  const perpx = vx - along*dirx, perpy = vy - along*diry;
  const newAlong = along*stretch + dist;
  return [cx + perpx + newAlong*dirx, cy + perpy + newAlong*diry];
}

export function stadiumPoints(hx, hy, w, h, n){
  n = n || 16;
  const r = h/2;
  const rightC = [hx + w/2 - r, hy], leftC = [hx - w/2 + r, hy];
  const pts = [];
  for(let i=0;i<=n;i++){
    const t = -Math.PI/2 + (i/n)*Math.PI;
    pts.push([rightC[0] + r*Math.cos(t), rightC[1] + r*Math.sin(t)]);
  }
  for(let i=0;i<=n;i++){
    const t = Math.PI/2 + (i/n)*Math.PI;
    pts.push([leftC[0] + r*Math.cos(t), leftC[1] + r*Math.sin(t)]);
  }
  return pts;
}

function ratingToT(r){
  if(r <= 1) return 0;
  if(r >= 5) return 1;
  for(let i=0;i<RADIUS_BREAKPOINTS.length-1;i++){
    const [r0,t0] = RADIUS_BREAKPOINTS[i], [r1,t1] = RADIUS_BREAKPOINTS[i+1];
    if(r <= r1) return t0 + (r-r0)/(r1-r0)*(t1-t0);
  }
}
export { ratingToT };

export function renderShopRadar(shop, opts){
  const showLabels = !opts || opts.showLabels !== false;
  if(!shop.ratings) return '';
  const present = Object.keys(shop.ratings);
  const keys = [
    ...CATEGORY_ORDER.filter(k => present.includes(k)),
    ...present.filter(k => !CATEGORY_ORDER.includes(k))
  ];
  if(keys.length < 3) return ''; // not enough axes for a sensible radar

  const values = keys.map(k => shop.ratings[k]);
  const labels = keys.map(k => k.charAt(0).toUpperCase() + k.slice(1));
  const step = 360 / keys.length;

  const size = 240, cx = 110, cy = size/2, rimThick = 9, cupR = 78, coffeeR = cupR - rimThick;
  const blobR = coffeeR * 0.82;
  const lightDeg = 315, feather = 2.5, shadowDist = 34, stretch = 1.4;
  const hw = 40, hh = 22, hx = cx + cupR - 3, hy = cy;

  const dataPts = values.map((v,i) => polarPoint(cx, cy, 6 + ratingToT(v)*blobR, i*step));
  const id = 'radar-' + Math.round(values.reduce((s,v)=>s+v,0)*10) + '-' + keys.length;

  // Fused cast shadow: rim + handle silhouettes stretched together as one path.
  const [dirx,diry] = polarPoint(0, 0, 1, lightDeg + 180);
  const rimPts = Array.from({length:64}, (_,i) => polarPoint(cx, cy, cupR, (i/64)*360));
  const handlePts = stadiumPoints(hx, hy, hw, hh, 16);
  const rimShadowPts = rimPts.map(([x,y]) => stretchPoint(x,y,cx,cy,dirx,diry,stretch,shadowDist));
  const handleShadowPts = handlePts.map(([x,y]) => stretchPoint(x,y,cx,cy,dirx,diry,stretch,shadowDist));
  const rimShadowPath = smoothClosedPath(rimShadowPts, 0.6);
  const handleShadowPath = smoothClosedPath(handleShadowPts, 0.6);
  // The shadow's actual farthest point (the rim, stretched) sits at
  // shadowDist + cupR*stretch from center — the handle never reaches
  // further than that. Used for the gradient's fade-to-transparent point.
  const shadowReach = shadowDist + cupR*stretch;
  const shadowFar = polarPoint(cx, cy, shadowReach, lightDeg + 180);
  // The handle sits off-center, so its stretched shadow actually reaches
  // further out (in absolute x/y) than the rim's does — use the real
  // sampled extent of both shadow shapes for layout instead of a
  // center-based approximation, so nothing gets hard-clipped by the
  // viewBox even at the shadow's faint outer edge.
  const allShadowPts = rimShadowPts.concat(handleShadowPts);
  const shadowMinX = Math.min(...allShadowPts.map(p=>p[0]));
  const shadowMaxX = Math.max(...allShadowPts.map(p=>p[0]));
  const shadowMinY = Math.min(...allShadowPts.map(p=>p[1]));
  const shadowMaxY = Math.max(...allShadowPts.map(p=>p[1]));

  // Gloss highlight arc on the rim, on the side facing the light.
  const half = 38;
  const hlA = polarPoint(cx, cy, cupR-2.5, lightDeg-half), hlB = polarPoint(cx, cy, cupR-2.5, lightDeg+half);
  const hlMid = polarPoint(cx, cy, cupR-5.5, lightDeg);

  // Handle gloss streak, on whichever edge of the pill faces the light.
  const lr = (lightDeg-90) * Math.PI/180;
  const vx = Math.cos(lr), vy = Math.sin(lr);
  const streakY = hy + vy*hh*0.32, streakX = hx + vx*hw*0.12, streakBow = -vy*hh*0.22;

  // Foam: 3 nested copies of the same rating shape, scaled toward the
  // center and each a step lighter, so it reads as layered crema rather
  // than one flat fill.
  const scaleToward = f => dataPts.map(([x,y]) => [cx+(x-cx)*f, cy+(y-cy)*f]);
  const foamLayers = [
    {f:1.0,  fill:'var(--crema)'},
    {f:0.68, fill:'var(--crema-light)'},
    {f:0.36, fill:'var(--crema-lightest)'}
  ].map(l => `<path d="${smoothClosedPath(scaleToward(l.f))}" fill="${l.fill}"/>`).join('');

  // Category name + value are anchored together at the fixed end of each
  // axis (just past the outer ring), pulled outward a bit further on the
  // bottom-leaning axes so they clear the rim.
  const labelBaseR = cupR + 20;
  const labelPts = showLabels ? keys.map((_,i) => {
    const deg = i*step, rad = (deg-90)*Math.PI/180, extra = Math.max(0, Math.sin(rad))*11;
    return polarPoint(cx, cy, labelBaseR+extra, deg);
  }) : [];
  const labelsSvg = showLabels ? keys.map((k,i) => {
    const [x,y] = labelPts[i];
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">
      <tspan x="${x}" dy="-5.5" fill="var(--dim)" font-size="10.5">${labels[i]}</tspan>
      <tspan x="${x}" dy="13.5" font-weight="700" font-size="12" fill="var(--ink)">${values[i].toFixed(1)}</tspan>
    </text>`;
  }).join('') : '';

  // Tight viewBox around the actual drawn extent — labels (when shown),
  // handle, and the stretched shadow all factor in so nothing gets
  // clipped. Mirrored around the cup's true center (cx,cy) so the cup
  // itself always sits centered in the panel, instead of getting pulled
  // off-center by the shadow, which only extends on one side. Skipping the
  // label points when they're hidden lets the viewBox hug the cup itself,
  // which is what makes the label-less radar render noticeably bigger
  // inside the same container.
  const labelXs = labelPts.map(p=>p[0]), labelYs = labelPts.map(p=>p[1]);
  const rawLeft = Math.min(...labelXs, cx-cupR-4, shadowMinX) - 14;
  const rawRight = Math.max(...labelXs, hx+hw, cx+cupR+4, shadowMaxX) + 14;
  const rawTop = Math.min(...labelYs, cy-cupR-4, shadowMinY) - 15;
  const rawBottom = Math.max(...labelYs, cy+cupR+4, shadowMaxY) + 14;
  const halfW = Math.max(cx-rawLeft, rawRight-cx);
  const halfH = Math.max(cy-rawTop, rawBottom-cy);
  const left = cx-halfW, right = cx+halfW, top = cy-halfH, bottom = cy+halfH;

  return `<svg viewBox="${left} ${top} ${right-left} ${bottom-top}">
    <defs>
      <radialGradient id="coffee-${id}" cx="42%" cy="38%" r="70%">
        <stop offset="0%" stop-color="var(--coffee-mid)"/>
        <stop offset="100%" stop-color="var(--coffee-dark)"/>
      </radialGradient>
      <radialGradient id="innerShadow-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="78%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
      </radialGradient>
      <linearGradient id="shadowFade-${id}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="${cy}" x2="${shadowFar[0]}" y2="${shadowFar[1]}">
        <stop offset="0%" stop-color="#241608" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#241608" stop-opacity="0"/>
      </linearGradient>
      <filter id="foamShadow-${id}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
      </filter>
      <filter id="softBlur-${id}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.6"/>
      </filter>
      <filter id="shadowBlur-${id}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="${feather}"/>
      </filter>
    </defs>
    <g filter="url(#shadowBlur-${id})">
      <path d="${rimShadowPath} ${handleShadowPath}" fill="url(#shadowFade-${id})"/>
    </g>
    <rect x="${hx-hw/2}" y="${hy-hh/2}" width="${hw}" height="${hh}" rx="${hh/2}" ry="${hh/2}" fill="var(--ceramic)" stroke="var(--ceramic-edge)" stroke-width="1"/>
    <path d="M ${streakX-hw*0.28},${streakY} Q ${streakX},${streakY+streakBow} ${streakX+hw*0.28},${streakY}" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="2" fill="none" stroke-linecap="round" filter="url(#softBlur-${id})"/>
    <circle cx="${cx}" cy="${cy}" r="${cupR}" fill="var(--ceramic)" stroke="var(--ceramic-edge)" stroke-width="1"/>
    <path d="M ${hlA[0]},${hlA[1]} Q ${hlMid[0]},${hlMid[1]} ${hlB[0]},${hlB[1]}" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="2.6" fill="none" stroke-linecap="round" filter="url(#softBlur-${id})"/>
    <circle cx="${cx}" cy="${cy}" r="${coffeeR}" fill="url(#coffee-${id})" stroke="#160D04" stroke-width="1"/>
    <g filter="url(#foamShadow-${id})">${foamLayers}</g>
    <circle cx="${cx}" cy="${cy}" r="3" fill="var(--crema-lightest)"/>
    <circle cx="${cx}" cy="${cy}" r="${coffeeR}" fill="url(#innerShadow-${id})"/>
    ${labelsSvg}
  </svg>`;
}

// Same cup — rim, handle, gloss, cast shadow and all — as the single-shop
// radar in the detail panel (see renderShopRadar above), just with two
// translucent foam traces poured on top instead of one layered/nested
// one. Keeping the full mug drawing (rather than a bare circle) is what
// makes this read as "the same coffee radar" instead of a generic chart.
// Only axes both shops actually have ratings for are drawn, so a
// mismatched pair still renders a fair, apples-to-apples shape.
export function renderCompareRadar(a, b){
  if(!a || !b || !a.ratings || !b.ratings) return '';
  const presentA = Object.keys(a.ratings);
  const presentB = Object.keys(b.ratings);
  const shared = CATEGORY_ORDER.filter(k => presentA.includes(k) && presentB.includes(k));
  if(shared.length < 3) return '';

  const valuesA = shared.map(k => a.ratings[k]), valuesB = shared.map(k => b.ratings[k]);
  const labels = shared.map(k => k.charAt(0).toUpperCase() + k.slice(1));
  const step = 360 / shared.length;

  const size = 240, cx = 110, cy = size/2, rimThick = 9, cupR = 78, coffeeR = cupR - rimThick;
  const blobR = coffeeR * 0.82;
  const lightDeg = 315, feather = 2.5, shadowDist = 34, stretch = 1.4;
  const hw = 40, hh = 22, hx = cx + cupR - 3, hy = cy;

  const ptsFor = values => values.map((v,i) => polarPoint(cx, cy, 6 + ratingToT(v)*blobR, i*step));
  const dataPtsA = ptsFor(valuesA), dataPtsB = ptsFor(valuesB);
  const id = 'cmp-' + Math.round((valuesA.reduce((s,v)=>s+v,0) + valuesB.reduce((s,v)=>s+v,0)) * 10) + '-' + shared.length;

  // Fused cast shadow: rim + handle silhouettes stretched together as one
  // path — identical math to renderShopRadar above.
  const [dirx,diry] = polarPoint(0, 0, 1, lightDeg + 180);
  const rimPts = Array.from({length:64}, (_,i) => polarPoint(cx, cy, cupR, (i/64)*360));
  const handlePts = stadiumPoints(hx, hy, hw, hh, 16);
  const rimShadowPts = rimPts.map(([x,y]) => stretchPoint(x,y,cx,cy,dirx,diry,stretch,shadowDist));
  const handleShadowPts = handlePts.map(([x,y]) => stretchPoint(x,y,cx,cy,dirx,diry,stretch,shadowDist));
  const rimShadowPath = smoothClosedPath(rimShadowPts, 0.6);
  const handleShadowPath = smoothClosedPath(handleShadowPts, 0.6);
  const shadowReach = shadowDist + cupR*stretch;
  const shadowFar = polarPoint(cx, cy, shadowReach, lightDeg + 180);
  const allShadowPts = rimShadowPts.concat(handleShadowPts);
  const shadowMinX = Math.min(...allShadowPts.map(p=>p[0]));
  const shadowMaxX = Math.max(...allShadowPts.map(p=>p[0]));
  const shadowMinY = Math.min(...allShadowPts.map(p=>p[1]));
  const shadowMaxY = Math.max(...allShadowPts.map(p=>p[1]));

  // Gloss highlight arc on the rim, and the handle's streak, both on the
  // side facing the light — same as renderShopRadar above.
  const half = 38;
  const hlA = polarPoint(cx, cy, cupR-2.5, lightDeg-half), hlB = polarPoint(cx, cy, cupR-2.5, lightDeg+half);
  const hlMid = polarPoint(cx, cy, cupR-5.5, lightDeg);
  const lr = (lightDeg-90) * Math.PI/180;
  const vx = Math.cos(lr), vy = Math.sin(lr);
  const streakY = hy + vy*hh*0.32, streakX = hx + vx*hw*0.12, streakBow = -vy*hh*0.22;

  const labelBaseR = cupR + 20;
  const labelPts = shared.map((_,i) => {
    const deg = i*step, rad = (deg-90)*Math.PI/180, extra = Math.max(0, Math.sin(rad))*11;
    return polarPoint(cx, cy, labelBaseR+extra, deg);
  });
  const labelsSvg = shared.map((k,i) => {
    const [x,y] = labelPts[i];
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">
      <tspan x="${x}" dy="0" fill="var(--dim)" font-size="10.5">${labels[i]}</tspan>
    </text>`;
  }).join('');

  const rawLeft = Math.min(...labelPts.map(p=>p[0]), cx-cupR-4, shadowMinX) - 14;
  const rawRight = Math.max(...labelPts.map(p=>p[0]), hx+hw, cx+cupR+4, shadowMaxX) + 14;
  const rawTop = Math.min(...labelPts.map(p=>p[1]), cy-cupR-4, shadowMinY) - 15;
  const rawBottom = Math.max(...labelPts.map(p=>p[1]), cy+cupR+4, shadowMaxY) + 14;
  const halfW = Math.max(cx-rawLeft, rawRight-cx);
  const halfH = Math.max(cy-rawTop, rawBottom-cy);
  const left = cx-halfW, right = cx+halfW, top = cy-halfH, bottom = cy+halfH;

  return `<svg viewBox="${left} ${top} ${right-left} ${bottom-top}">
    <defs>
      <radialGradient id="cmpCoffee-${id}" cx="42%" cy="38%" r="70%">
        <stop offset="0%" stop-color="var(--coffee-mid)"/>
        <stop offset="100%" stop-color="var(--coffee-dark)"/>
      </radialGradient>
      <radialGradient id="cmpInnerShadow-${id}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="78%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.4"/>
      </radialGradient>
      <linearGradient id="cmpShadowFade-${id}" gradientUnits="userSpaceOnUse" x1="${cx}" y1="${cy}" x2="${shadowFar[0]}" y2="${shadowFar[1]}">
        <stop offset="0%" stop-color="#241608" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#241608" stop-opacity="0"/>
      </linearGradient>
      <filter id="cmpFoamShadow-${id}" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
      </filter>
      <filter id="cmpSoftBlur-${id}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="0.6"/>
      </filter>
      <filter id="cmpShadowBlur-${id}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="${feather}"/>
      </filter>
    </defs>
    <g filter="url(#cmpShadowBlur-${id})">
      <path d="${rimShadowPath} ${handleShadowPath}" fill="url(#cmpShadowFade-${id})"/>
    </g>
    <rect x="${hx-hw/2}" y="${hy-hh/2}" width="${hw}" height="${hh}" rx="${hh/2}" ry="${hh/2}" fill="var(--ceramic)" stroke="var(--ceramic-edge)" stroke-width="1"/>
    <path d="M ${streakX-hw*0.28},${streakY} Q ${streakX},${streakY+streakBow} ${streakX+hw*0.28},${streakY}" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="2" fill="none" stroke-linecap="round" filter="url(#cmpSoftBlur-${id})"/>
    <circle cx="${cx}" cy="${cy}" r="${cupR}" fill="var(--ceramic)" stroke="var(--ceramic-edge)" stroke-width="1"/>
    <path d="M ${hlA[0]},${hlA[1]} Q ${hlMid[0]},${hlMid[1]} ${hlB[0]},${hlB[1]}" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="2.6" fill="none" stroke-linecap="round" filter="url(#cmpSoftBlur-${id})"/>
    <circle cx="${cx}" cy="${cy}" r="${coffeeR}" fill="url(#cmpCoffee-${id})" stroke="#160D04" stroke-width="1"/>
    <g filter="url(#cmpFoamShadow-${id})">
      <path d="${smoothClosedPath(dataPtsB)}" fill="${COMPARE_COLOR_B}" fill-opacity="0.45"/>
      <path d="${smoothClosedPath(dataPtsA)}" fill="${COMPARE_COLOR_A}" fill-opacity="0.45"/>
      <path d="${smoothClosedPath(dataPtsB)}" fill="none" stroke="${COMPARE_COLOR_B}" stroke-width="2.25"/>
      <path d="${smoothClosedPath(dataPtsA)}" fill="none" stroke="${COMPARE_COLOR_A}" stroke-width="2.25"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${coffeeR}" fill="url(#cmpInnerShadow-${id})"/>
    ${labelsSvg}
  </svg>`;
}
