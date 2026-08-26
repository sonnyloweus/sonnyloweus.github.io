/* global L */
import { S } from './state.js';
import { formatDay } from './data.js';
import { haversineMiles } from './stats.js';
import { JOURNEY_MIN_ZOOM, JOURNEY_MAX_ZOOM } from './constants.js';
import { updateHeatLayer } from './map.js';
import { updateInViewStats } from './stats.js';
import { applyFilters } from './filters.js';

// ---- Show Journey: an animated dashed line travels between each dated
// visit in chronological order (ignoring current filters), camera follows
// the traveling point, and each pin only appears once the line reaches it ----

export function buildArc(fromShop, toShop, steps){
  const lat1 = fromShop.lat, lng1 = fromShop.lng, lat2 = toShop.lat, lng2 = toShop.lng;
  const dLat = lat2 - lat1, dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat*dLat + dLng*dLng);
  if(dist === 0) return [[lat1,lng1],[lat2,lng2]];
  const midLat = (lat1+lat2)/2, midLng = (lng1+lng2)/2;
  const bulge = dist * 0.15;
  const ctrlLat = midLat + (-dLng/dist) * bulge;
  const ctrlLng = midLng + (dLat/dist) * bulge;
  const pts = [];
  for(let i = 0; i <= steps; i++){
    const t = i/steps;
    const lat = (1-t)*(1-t)*lat1 + 2*(1-t)*t*ctrlLat + t*t*lat2;
    const lng = (1-t)*(1-t)*lng1 + 2*(1-t)*t*ctrlLng + t*t*lng2;
    pts.push([lat, lng]);
  }
  return pts;
}

export function targetZoomForBounds(bounds){
  let z;
  try{ z = S.map.getBoundsZoom(bounds, false, L.point(90, 90)); }
  catch(e){ z = JOURNEY_MAX_ZOOM; }
  if(!isFinite(z)) z = JOURNEY_MAX_ZOOM;
  return Math.min(JOURNEY_MAX_ZOOM, Math.max(JOURNEY_MIN_ZOOM, z));
}

export function populateStop(entry){
  S.clusterGroup.addLayer(entry.marker);
  S.activeSet.add(entry.marker);
  updateHeatLayer();
  const el = entry.marker.getElement();
  const bubble = el && el.querySelector('.bubble');
  if(bubble){
    bubble.classList.add('journey-active');
    setTimeout(() => bubble.classList.remove('journey-active'), 900);
  }
}

// One continuous motion — pan, zoom, and the drawing line all animate
// together in the same loop, rather than a separate "zoom to fit" step
// before the line starts drawing.
// Camera motion is delegated entirely to Leaflet's own native flyTo — called
// once per leg, GPU-smooth, and it knows how to animate marker clusters
// cleanly. The line-draw runs as a fully separate loop that never touches
// the map view itself, so it can't fight with or stutter the camera.
export function animateLeg(fromEntry, toEntry){
  return new Promise(resolve => {
    const curve = buildArc(fromEntry.shop, toEntry.shop, 64);
    const distanceMi = haversineMiles(fromEntry.shop.lat, fromEntry.shop.lng, toEntry.shop.lat, toEntry.shop.lng);
    const duration = Math.min(2600, 900 + Math.log(distanceMi + 1) * 300);
    const legLine = L.polyline([], {color:'rgba(59,42,30,0.6)', weight:2, dashArray:'5 7', lineCap:'round'}).addTo(S.map);
    S.journeyLines.push(legLine);

    const bounds = L.latLngBounds([[fromEntry.shop.lat, fromEntry.shop.lng], [toEntry.shop.lat, toEntry.shop.lng]]);
    const targetZoom = targetZoomForBounds(bounds);
    S.map.flyTo([toEntry.shop.lat, toEntry.shop.lng], targetZoom, {duration: duration/1000});

    const start = performance.now();
    function frame(now){
      if(!S.journeyOn){ resolve(); return; }
      const t = Math.min(1, (now - start) / duration);
      const count = Math.max(2, Math.round(t * curve.length));
      legLine.setLatLngs(curve.slice(0, count));
      if(t < 1){
        S.journeyAnimFrame = requestAnimationFrame(frame);
      }else{
        resolve();
      }
    }
    S.journeyAnimFrame = requestAnimationFrame(frame);
  });
}

export function updateJourneyLabel(entry, idx){
  document.getElementById('journey-name').textContent = entry.shop.name;
  const metaBits = [entry.shop.area, entry.shop.country].filter(Boolean).join(', ');
  document.getElementById('journey-meta').textContent = `${metaBits} · ${formatDay(entry.earliestDay)}`;
  document.getElementById('journey-progress').textContent = `${idx + 1} / ${S.journeyStops.length}`;
}

async function runJourney(){
  // first stop appears immediately
  updateJourneyLabel(S.journeyStops[0], 0);
  S.map.flyTo([S.journeyStops[0].shop.lat, S.journeyStops[0].shop.lng], Math.min(JOURNEY_MAX_ZOOM, 13), {duration:0.6});
  await new Promise(r => setTimeout(r, 650));
  if(!S.journeyOn) return;
  populateStop(S.journeyStops[0]);

  for(let i = 0; i < S.journeyStops.length - 1; i++){
    if(!S.journeyOn) return;
    const from = S.journeyStops[i], to = S.journeyStops[i+1];
    updateJourneyLabel(to, i+1);
    await animateLeg(from, to);
    if(!S.journeyOn) return;
    populateStop(to);
    await new Promise(r => { S.journeyPauseTimer = setTimeout(r, 350); });
  }
  if(S.journeyOn) stopJourney();
}

export function startJourney(){
  if(S.journeyOn) return;
  S.journeyStops = S.shopMarkers
    .filter(e => e.earliestDay !== null)
    .sort((a,b) => a.earliestDay - b.earliestDay);
  if(S.journeyStops.length < 2) return;

  S.journeyOn = true;
  document.getElementById('toggle-journey').classList.add('on');
  S.scrubberEl.style.display = 'none';
  document.getElementById('journey-bar').style.display = 'flex';

  S.clusterGroup.clearLayers();
  S.activeSet = new Set();
  updateHeatLayer();
  S.currentVisible = [];
  if(S.trailLine){ S.map.removeLayer(S.trailLine); S.trailLine = null; }
  updateInViewStats();

  runJourney();
}

export function stopJourney(){
  S.journeyOn = false;
  if(S.journeyAnimFrame) cancelAnimationFrame(S.journeyAnimFrame);
  clearTimeout(S.journeyPauseTimer);
  S.journeyLines.forEach(l => S.map.removeLayer(l));
  S.journeyLines = [];
  document.querySelectorAll('.bubble.journey-active').forEach(el => el.classList.remove('journey-active'));
  document.getElementById('toggle-journey').classList.remove('on');
  document.getElementById('journey-bar').style.display = 'none';
  if(S.scrubberShouldShow) S.scrubberEl.style.display = 'block';
  applyFilters(); // resync the map back to whatever filters/date range are actually active
}

// Journey UI entry point removed for now (button pulled, animation kept for
// a possible future revisit) — startJourney()/stopJourney() are still fully
// wired internally, just nothing currently calls startJourney().
export function wireJourneyListeners(){
  document.getElementById('journey-stop').onclick = stopJourney;
}
