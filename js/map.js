/* global L */
import { S } from './state.js';
import { loadData, tierClass, displayRating, computeRatingBounds, saveStoredSetting, applyPalette, earliestVisit } from './data.js';
import { RATING_PALETTES, CLUSTER_ZOOM_STEP, POP_EASE, POP_IN_BASE_WAIT, MIN_ZOOM_FLOOR, MIN_ZOOM_CEILING, MIN_ZOOM_BUFFER, CARTO_API_KEY } from './constants.js';
import { renderIntroSlide } from './modal.js';
import { showOnThisDay, updateInViewStats, showCountSpinner } from './stats.js';
import { setupFilters, passesNonDateFilters } from './filters.js';
import { setupCompare } from './compare.js';
import { closeOtherSidePanels, refreshRatingDependentUI, hidePanel, showPanel } from './panel.js';
import { wireJourneyListeners } from './journey.js';

// activeGroup / clusterGroup / plainGroup are read from many other modules
// (filters.js's applyFilters, journey.js, panel.js's refreshRatingDependentUI),
// so this stays a plain exported function reading shared state rather than
// a closed-over local.
export function activeGroup(){ return S.clusteringOn ? S.clusterGroup : S.plainGroup; }

// ---- hotspot heatmap ----
// A single continuous leaflet.heat layer (same plugin family behind
// weather-radar overlays) instead of one shape per shop. Its point data is
// rebuilt from scratch in updateHeatLayer() any time the visible set
// changes — see refreshDependentUI() below, the same hook updateTrail()
// uses — rather than incrementally added/removed like the pill markers,
// since leaflet.heat has no per-point add/remove API worth relying on.
// Gradient rides the active rating theme (see RATING_PALETTES) instead of
// a fixed color — same 7-step gradient the pills use, just continuous.
// Recomputed on the fly (heatGradientForPalette) rather than reading the
// --tier-N CSS custom properties, since leaflet.heat renders to canvas and
// needs literal color strings, not CSS values.
export function heatGradientForPalette(key){
  const palette = RATING_PALETTES[key] || RATING_PALETTES.roast;
  const stops = {};
  palette.colors.forEach((c, i) => { stops[(i + 1) / palette.colors.length] = c; });
  return stops;
}

// Walks every recorded visit (not just each shop's earliest) in
// chronological order, collapsing only *consecutive* repeats at the same
// shop into one "stay" — back-to-back mornings at the same regular are
// zero real movement, not a leg of the trip. A shop you left and later
// came back to (a non-consecutive repeat) still gets its own stay and
// its own segment. See buildTrailPath below for why this matters:
// without collapsing, a 30-visit-in-a-row streak at one spot would draw
// 29 overlapping zero-length loops on top of it.
export function buildTrailStays(shops){
  const events = [];
  shops.forEach(s => {
    (s.visited || []).forEach(dateStr => {
      const t = new Date(dateStr).getTime();
      if(!isNaN(t)) events.push({t, shop: s});
    });
  });
  events.sort((a,b) => a.t - b.t);
  const stays = [];
  events.forEach(e => {
    if(stays.length && stays[stays.length-1].shop === e.shop) return;
    stays.push(e);
  });
  return stays;
}

// Straight-line pass through every stay, in order. No bowing yet — that's
// a follow-up (paths should start straight and only bow once a given
// pair of places has been walked more than once — see discussion before
// this commit). For now this just fixes the actual bug: every return
// trip gets its own segment instead of collapsing to one node per shop.
export function buildTrailPath(stays){
  return stays.map(st => [st.shop.lat, st.shop.lng]);
}

export function updateTrail(){
  if(S.trailLine){ S.map.removeLayer(S.trailLine); S.trailLine = null; }
  if(S.trailOn){
    const stays = buildTrailStays(S.currentVisible);
    if(stays.length > 1){
      S.trailLine = L.polyline(buildTrailPath(stays), {
        color: 'rgba(59,42,30,0.4)', weight: 1.5, dashArray: '3 7', lineCap: 'round'
      }).addTo(S.map);
      S.trailLine.bringToBack();
    }
  }
}

// ---- markers are created once per shop; filtering just adds/removes
// them from the cluster group instead of rebuilding everything ----
// buildBubbleIcon is shared by initial creation and by applyFilters, so a
// shop's ×N badge can be refreshed in place to show only the visits that
// fall inside the current date range (see applyFilters below). `animate`
// is off for in-place refreshes so dragging the slider doesn't replay the
// pop-in animation on every pin whose count ticks up or down.
export function buildBubbleIcon(shop, badgeCount, opts){
  opts = opts || {};
  // Bigger on mobile only — desktop's precise cursor doesn't need it, and
  // a larger pin there would just crowd the map unnecessarily.
  const w = S.isMobileViewport ? 40 : 34, h = S.isMobileViewport ? 27 : 22;
  // On touch, the actual tap target (what Leaflet sizes via iconSize
  // below) is padded out beyond the visible pill — a fingertip needs a
  // bigger hit area than a cursor does, but growing the pill itself to
  // match would crowd/clutter the map. .bubble-hit centers the
  // normal-sized pill inside this larger invisible box.
  const hitW = w + S.BUBBLE_HIT_PAD.x * 2, hitH = h + S.BUBBLE_HIT_PAD.y * 2;
  const displayOverall = displayRating(shop.overall);
  const tier = tierClass(displayOverall);
  const animStyle = opts.animate ? `animation-delay:${opts.delay || 0}s;` : `animation:none;`;
  const visitBadge = badgeCount > 1 ? `<span class="visit-count">×${badgeCount}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<div class="bubble-hit"><div class="bubble ${tier}" style="width:${w}px;height:${h}px;${animStyle}">${displayOverall.toFixed(1)}${visitBadge}</div></div>`,
    iconSize: [hitW, hitH],
    iconAnchor: [hitW/2, hitH/2]
  });
}

// ---- hotspot heatmap intensity ----
// Each shop's heat "weight" is its in-range visit count (badgeCount — the
// same number driving the ×N badge) relative to the single most-visited
// shop in the *whole* dataset (computed once, not re-derived per filter)
// so the scale stays stable as you filter instead of rescaling every time
// the visible max shrinks. Floored above 0 so even a single-visit shop
// still registers a faint blob rather than vanishing entirely.
export function heatWeight(badgeCount){
  return Math.min(1, Math.max(0.08, Math.sqrt(Math.max(0, badgeCount) / S.MAX_LIFETIME_VISITS)));
}
// Rebuilds the heat layer's point data from whichever shops are currently
// active — called from refreshDependentUI() (see below) any time filters,
// the date range, or clustering change what's visible, same trigger
// updateTrail() uses.
export function updateHeatLayer(){
  const points = S.shopMarkers
    .filter(e => S.activeSet.has(e.marker))
    .map(e => [e.shop.lat, e.shop.lng, heatWeight(e.badgeCount)]);
  S.heatLayer.setLatLngs(points);
}

// ---- pop-in timing helper: given the entries about to be revealed,
// returns an eased delay (seconds) per original index, ranked chronologically
// by each shop's earliest visit so the reveal visibly retraces the actual
// trip in order instead of popping in scattered or coffee.json order.
// Undated shops (no recorded visit day) have no place in that timeline, so
// they're ranked after every dated shop, ordered west-to-east among
// themselves — the old sweep behavior, just demoted to a fallback. A touch
// of random jitter is layered on top so pins visited on the same day (or
// undated pins at nearly the same longitude) don't feel robotically synced.
// POP_EASE > 1 means the gap between each successive pop widens as the
// reveal goes on, instead of a flat, evenly-spaced tick. ----
export function easedPopDelays(entries, spread){
  const n = entries.length;
  const order = entries.map((_, i) => i).sort((a, b) => {
    const da = entries[a].earliestDay, db = entries[b].earliestDay;
    if(da === null && db === null) return entries[a].shop.lng - entries[b].shop.lng;
    if(da === null) return 1;
    if(db === null) return -1;
    return da - db;
  });
  const rank = new Array(n);
  order.forEach((originalIdx, pos) => { rank[originalIdx] = pos; });
  return rank.map(pos => {
    const t = n > 1 ? pos / (n - 1) : 0;
    return Math.pow(t, POP_EASE) * spread + Math.random() * 0.12;
  });
}

// Markers are built up front but NOT added to the map here — they're
// staggered onto the cluster group later (see revealMarkers), one at a
// time, so clusters actually form and grow live as pins land instead of
// the whole cluster snapping into its final shape the instant everything
// is added in one synchronous batch. Each marker's own bubble still gets
// the CSS pop (0.3s, scale+fade) the moment it's added to the map.
export function makeMarkerFor(shop, i, initialBadgeCount){
  const icon = buildBubbleIcon(shop, initialBadgeCount, { animate: true, delay: 0 });
  const marker = L.marker([shop.lat, shop.lng], {
    icon,
    zIndexOffset: Math.round(shop.overall * 1000) // higher-rated pins render on top when overlapping
  });
  marker.shopRating = shop.overall;
  // -14 tuned against the visible pill; the hit box grew by BUBBLE_HIT_PAD.y
  // on each side (see buildBubbleIcon), so pull the tooltip back down by
  // that much to keep it sitting the same visual distance above the pill.
  marker.bindTooltip(shop.name, {direction:'top', offset:[0, -14 + S.BUBBLE_HIT_PAD.y], className:'mini-tip'});
  marker.on('click', () => showPanel(shop));
  return marker;
}

// Shared by applyFilters() and revealMarkers(): refreshes each entry's
// visit-count badge for the current date range and returns the list of
// entries that should currently be on the map, without touching activeSet
// or the map itself — the two callers differ only in *how* they add them
// (instantly vs. staggered).
export function syncBadgeCountsAndGetActive(){
  const active = [];
  S.shopMarkers.forEach(entry => {
    const hasDates = entry.visitDays.length > 0;
    // A shop stays on the map as long as at least one of its visits falls
    // in the selected range — it just shows however many of its visits
    // landed there. It only drops off once that count hits zero.
    const inRangeCount = hasDates
      ? entry.visitDays.reduce((n, d) => n + (d >= S.lowDay && d <= S.highDay ? 1 : 0), 0)
      : 0;
    const dateOk = !hasDates || inRangeCount > 0;

    if(hasDates && inRangeCount !== entry.badgeCount){
      entry.marker.setIcon(buildBubbleIcon(entry.shop, inRangeCount, { animate: false }));
      entry.badgeCount = inRangeCount;
    }

    if(dateOk && passesNonDateFilters(entry.shop)) active.push(entry);
  });
  return active;
}

export function refreshDependentUI(){
  S.currentVisible = S.shopMarkers.filter(e => S.activeSet.has(e.marker)).map(e => e.shop);
  updateTrail();
  updateHeatLayer();
  updateInViewStats();
}

// The reveal: adds currently-eligible-but-not-yet-active markers to the
// map one at a time on a randomized, eased schedule (see easedPopDelays)
// instead of all at once. Because each addLayer() call happens for real,
// spaced out over time, the cluster group actually recomputes and regrows
// its bubbles live as pins land near each other — clusters form
// dynamically along with the individual pop-ins, rather than the whole
// group (clustered or not) just snapping into its finished layout.
//
// While S.trailOn, the crawl line rides along with the reveal instead of
// snapping in fully-formed once every pin has landed (that's still what
// updateTrail() does — called once at the end via refreshDependentUI() to
// swap in the authoritative trail, which also threads in repeat visits
// that this per-shop reveal order doesn't know about). A dedicated `arrived`
// set (rather than trusting setTimeout firing order) keeps the drawn line
// in true chronological order even if two close-together delays fire out
// of sequence because of the jitter in easedPopDelays.
export function revealMarkers(baseWaitSec){
  const entries = syncBadgeCountsAndGetActive().filter(e => !S.activeSet.has(e.marker));
  const n = entries.length;
  if(!n){ refreshDependentUI(); return; }
  // The "N in view · avg" readout is stale/inaccurate for the whole
  // stretch of time these pins are staggering onto the map (up to a few
  // seconds — see the `spread` cap below), so swap it for a spinner until
  // refreshDependentUI() below fills it back in for real.
  showCountSpinner();
  const spread = Math.min(3.4, 0.65 + n * 0.05); // total fill duration, capped for huge lists
  const delays = easedPopDelays(entries, spread);

  const datedChrono = entries
    .filter(e => e.earliestDay !== null)
    .sort((a, b) => a.earliestDay - b.earliestDay);
  const trailArrived = new Set();
  if(S.trailOn && datedChrono.length){
    if(S.trailLine){ S.map.removeLayer(S.trailLine); S.trailLine = null; }
    S.trailLine = L.polyline([], {
      color: 'rgba(59,42,30,0.4)', weight: 1.5, dashArray: '3 7', lineCap: 'round'
    }).addTo(S.map);
    S.trailLine.bringToBack();
  }

  let remaining = n;
  entries.forEach((entry, idx) => {
    const delay = (baseWaitSec || 0) + delays[idx];
    setTimeout(() => {
      activeGroup().addLayer(entry.marker);
      S.activeSet.add(entry.marker);
      updateHeatLayer();
      if(S.trailOn && S.trailLine && entry.earliestDay !== null){
        trailArrived.add(entry);
        const pts = datedChrono.filter(e => trailArrived.has(e)).map(e => [e.shop.lat, e.shop.lng]);
        S.trailLine.setLatLngs(pts);
      }
      remaining--;
      if(remaining === 0) refreshDependentUI();
    }, delay * 1000);
  });
}

// Replays the reveal on demand — e.g. from closeModal() for first-time
// visitors whose markers already finished popping in (and clustering
// already settled) behind the intro modal. Pulls everything back off the
// map first so revealMarkers() can stagger it back on and clusters can
// regrow live, instead of just replaying each pin's own pop in place.
export function popInVisibleMarkers(){
  S.shopMarkers.forEach(entry => {
    if(S.activeSet.has(entry.marker)){
      activeGroup().removeLayer(entry.marker);
      S.activeSet.delete(entry.marker);
    }
  });
  revealMarkers(0);
}

// ---- dynamic minZoom: "fully zoomed out" always means "see everything" ----
// A fixed minZoom shows a fixed screen-space slice of the map, not a fixed
// amount of *content* — a narrow phone viewport at that same zoom level
// shows far less width than a wide desktop window does, so a phone can get
// stuck unable to zoom out past a handful of pins (see MIN_ZOOM_* in
// constants.js for the full rationale). This recomputes the zoom level
// that actually fits S.dataBounds in the current viewport and uses that as
// the floor, capped so it never rises above the old fixed default on
// generously-wide screens. Called once at init and again on every map
// resize (Leaflet's own trackResize option already turns window
// resizes/orientation changes into a 'resize' event, so no separate
// window listener is needed here).
export function refreshMinZoom(){
  if(!S.map || !S.dataBounds || !S.dataBounds.isValid()) return;
  let fitZoom;
  try{ fitZoom = S.map.getBoundsZoom(S.dataBounds, false, L.point(60, 60)); }
  catch(e){ fitZoom = MIN_ZOOM_CEILING; }
  if(!isFinite(fitZoom)) fitZoom = MIN_ZOOM_CEILING;
  const newMin = Math.max(MIN_ZOOM_FLOOR, Math.min(MIN_ZOOM_CEILING, fitZoom - MIN_ZOOM_BUFFER));
  S.map.setMinZoom(newMin);
}

// ---- zoom-limit "rubber-band" feedback ----
// Leaflet clamps zoom silently at minZoom/maxZoom: if a gesture can't
// actually move the zoom level, no event fires at all, which on a
// touchscreen reads as "did my pinch even register?". There's no public
// hook for "a zoom gesture happened but got clamped", so this watches
// the raw wheel/touch input ourselves, alongside (not instead of)
// Leaflet's own handlers — passive listeners that never call
// preventDefault/stopPropagation, so Leaflet's real zoom handling is
// completely unaffected. When the gesture's direction pushes against a
// limit the map is already sitting at, it plays a quick overshoot pulse
// on the map container (see .zoom-limit-out/.zoom-limit-in in the
// <style> block) so the input always gets a visible response even when
// the zoom level itself can't move.
function setupZoomLimitFeedback(map){
  const el = map.getContainer();
  let bounceT = null, lastBounceAt = 0;
  function bounce(dir){
    const now = Date.now();
    if(now - lastBounceAt < 260) return; // throttle re-triggers mid-gesture
    lastBounceAt = now;
    const cls = dir === 'out' ? 'zoom-limit-out' : 'zoom-limit-in';
    const other = dir === 'out' ? 'zoom-limit-in' : 'zoom-limit-out';
    el.classList.remove(other, cls);
    void el.offsetWidth; // force reflow so re-adding the class restarts the animation
    el.classList.add(cls);
    clearTimeout(bounceT);
    bounceT = setTimeout(() => el.classList.remove(cls), 340);
  }

  // Trackpad/mouse-wheel zoom
  el.addEventListener('wheel', (e) => {
    if(e.deltaY > 0 && map.getZoom() <= map.getMinZoom()) bounce('out');
    else if(e.deltaY < 0 && map.getZoom() >= map.getMaxZoom()) bounce('in');
  }, {passive: true});

  // Touch pinch
  let pinchDist = null;
  function touchDist(touches){
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  el.addEventListener('touchstart', (e) => {
    pinchDist = e.touches.length === 2 ? touchDist(e.touches) : null;
  }, {passive: true});
  el.addEventListener('touchmove', (e) => {
    if(e.touches.length !== 2 || pinchDist == null) return;
    const d = touchDist(e.touches);
    const delta = d - pinchDist;
    if(Math.abs(delta) < 12) return; // ignore jitter below a real pinch intent
    if(delta < 0 && map.getZoom() <= map.getMinZoom()) bounce('out');
    else if(delta > 0 && map.getZoom() >= map.getMaxZoom()) bounce('in');
    pinchDist = d; // reset baseline so a sustained pinch-past-the-limit can keep bouncing (throttled above)
  }, {passive: true});
  el.addEventListener('touchend', () => { pinchDist = null; }, {passive: true});
}

// ---- rating colors & normalization (settings panel) ----
// Reflect whatever was restored from localStorage before initApp() ran
// (see S.activePalette/S.NORMALIZE_RATINGS, set by data.js's initSettings())
// — the markup's hardcoded "Roast, active / normalize off" state is just
// the pre-storage default.
function wireRatingSettingsListeners(){
  document.querySelectorAll('.palette-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.palette === S.activePalette);
    sw.onclick = () => {
      document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      S.activePalette = sw.dataset.palette;
      applyPalette(S.activePalette);
      S.heatLayer.setOptions({ gradient: heatGradientForPalette(S.activePalette) });
      saveStoredSetting('palette', S.activePalette);
    };
  });

  document.getElementById('switch-normalize').classList.toggle('on', S.NORMALIZE_RATINGS);
  document.getElementById('switch-normalize').onclick = (e) => {
    S.NORMALIZE_RATINGS = !S.NORMALIZE_RATINGS;
    e.currentTarget.classList.toggle('on', S.NORMALIZE_RATINGS);
    saveStoredSetting('normalize', S.NORMALIZE_RATINGS);
    refreshRatingDependentUI();
  };
}

// ---- The whole app bootstrap: loads data, builds the Leaflet map, wires
// filters/compare/journey, builds markers, and reveals them. Mirrors the
// original inline script's `(async function init(){...})()` IIFE — this is
// its direct replacement, called once from main.js. ----
export async function initApp(){
  const data = await loadData();
  S.GLOBAL_DATA = data;
  S.GLOBAL_AVG_RATING = data.length ? data.reduce((sum, s) => sum + s.overall, 0) / data.length : 0;
  computeRatingBounds();
  if(S.introIndex === 1) renderIntroSlide(); // refresh the "Loading the tally…" placeholder if still on that slide

  showOnThisDay(data);

  // Kept in sync with the `@media (max-width: 640px)` breakpoint in the
  // <style> block above — used to size pin/cluster bubbles a bit bigger
  // and space out clustering a bit more on phones, where fingers are far
  // less precise than a cursor. Read once at load; a phone doesn't
  // typically cross this breakpoint mid-session via resize, and re-reading
  // it live would mean rebuilding every marker on orientation change.
  S.isMobileViewport = window.matchMedia('(max-width: 640px)').matches;

  // Extra invisible tap-target padding around a marker's visible pill, on
  // touch only (see buildBubbleIcon) — a fingertip needs a bigger hit area
  // than a cursor, but growing the pill itself would clutter the map. Kept
  // here so the tooltip offset below can stay visually anchored to the
  // pill rather than drifting as the (larger) hit box grows.
  S.BUBBLE_HIT_PAD = S.isMobileViewport ? {x: 10, y: 9} : {x: 0, y: 0};

  const map = L.map('map', {
    zoomControl:false,
    attributionControl:true,
    minZoom: 3,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 1.0
  });
  S.map = map;
  if(data.length){
    const bounds = L.latLngBounds(data.map(s => [s.lat, s.lng]));
    S.dataBounds = bounds;
    // minZoom is recomputed *before* fitBounds below, not after — otherwise
    // a viewport narrow enough to need a lower floor than the old fixed
    // default would get its initial fitBounds clamped to that stale
    // (too-high) minZoom for one frame, showing a needlessly cropped view
    // before immediately snapping wider. Container size is already final
    // here (the map was just constructed against the real, laid-out #map
    // element), so getBoundsZoom's viewport read is accurate this early.
    refreshMinZoom();
    map.fitBounds(bounds, {padding:[60,60], maxZoom:13});
  }else{
    map.setView([20, 0], 3); // whole-world fallback if there's no data yet
  }
  map.on('resize', refreshMinZoom); // covers window resizes and, via Leaflet's trackResize, orientation changes

  // CARTO requires a free API key as of 2026 or every tile shows an
  // "api key required" watermark instead of the map. Get one at
  // https://carto.com/basemaps/apikey/ and set CARTO_API_KEY in
  // constants.js.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' + (CARTO_API_KEY ? '?key=' + CARTO_API_KEY : ''), {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd'
  }).addTo(map);

  setupZoomLimitFeedback(map);

  // The hotspot heatmap lives in its own pane, below Leaflet's default
  // markerPane (zIndex 600) — so the heat blob can never paint over a
  // rating pill or cluster bubble, no matter how it's layered.
  const heatPane = map.createPane('heatPane');
  heatPane.style.zIndex = 450;
  heatPane.style.pointerEvents = 'none';

  const clusterGroup = L.markerClusterGroup({
    // Was 2 ("basically only cluster pins that visually overlap"), which on
    // a touchscreen left too many near-neighbor pins each demanding a
    // pinpoint-precise tap. Loosened a bit on laptop, and more on mobile
    // since fingers are far less precise than a cursor.
    maxClusterRadius: S.isMobileViewport ? 11 : 6,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    // Leaflet.markercluster defaults this to true: it un-renders clusters
    // and markers that fall far outside the current viewport as a
    // performance optimization for large datasets, then re-adds them once
    // they're panned/zoomed back into range. With ~60 shops there's no
    // performance case for it, and it's a known source of markers that
    // fail to reappear — panning/zooming away and back can leave a pin
    // permanently missing if its re-add doesn't land cleanly (exactly the
    // "zoom in past a pin, zoom back out, it's gone" bug this fixes).
    // Turning it off means every marker just always exists on the map,
    // which removes the whole class of bug outright instead of chasing
    // the specific interaction that triggers it.
    removeOutsideVisibleBounds: false,
    // The plugin's built-in zoomToBoundsOnClick often only bumps the zoom by
    // a single level (it zooms just enough to fit the cluster's own bounds,
    // which — with such a tight maxClusterRadius — can be a barely-there
    // jump). We turn that off and drive the zoom step ourselves below so a
    // cluster click reliably zooms in by a fixed, tunable amount.
    zoomToBoundsOnClick: false,
    iconCreateFunction: function(cluster){
      const childMarkers = cluster.getAllChildMarkers();
      const avg = childMarkers.reduce((sum, m) => sum + m.shopRating, 0) / childMarkers.length;
      const displayAvg = displayRating(avg);
      const tier = tierClass(displayAvg);
      // Bigger hit target on mobile — easier to land a thumb on than a cursor.
      const w = S.isMobileViewport ? 50 : 42, h = S.isMobileViewport ? 31 : 26;
      // Clusters always render above individual pins, no matter how low their
      // average rating is — a cluster represents multiple locations, and
      // letting a single low-rated pin hide that (and its count badge) would
      // bury real information. Base offset (10000) clears the highest
      // possible individual zIndexOffset (rating 5 * 1000 = 5000).
      // When two clusters overlap, the bigger one (more shops) wins — it's
      // representing more information, so it shouldn't get buried under a
      // smaller-but-higher-rated cluster. Each extra child is worth 1000,
      // which dwarfs the rating term (avg * 10, max 50), so size always
      // decides first and rating only breaks a tie between same-size clusters.
      cluster.setZIndexOffset(10000 + childMarkers.length * 1000 + Math.round(avg * 10));
      // iconCreateFunction re-fires (and Leaflet.markercluster swaps in a
      // brand-new icon element) every time this cluster's membership changes
      // — including every extra pin that lands in it during the staggered
      // reveal. Popping the whole bubble in fresh on each of those updates
      // reads as flicker; it should only pop the first time this cluster
      // forms, then just update its average/count in place afterward. The
      // cluster object itself persists across those recomputations, so a
      // flag stashed on it is enough to tell "just formed" from "updated".
      const justFormed = !cluster._hasPoppedIn;
      cluster._hasPoppedIn = true;
      const animStyle = justFormed ? '' : 'animation:none;';
      return L.divIcon({
        className: '',
        html: `<div class="bubble cluster ${tier}" style="width:${w}px;height:${h}px;${animStyle}">${displayAvg.toFixed(1)}<span class="cluster-count">${childMarkers.length}</span></div>`,
        iconSize: [w, h],
        iconAnchor: [w/2, h/2]
      });
    }
  });
  S.clusterGroup = clusterGroup;
  clusterGroup.on('clusterclick', (e) => {
    const targetZoom = Math.min(map.getMaxZoom(), map.getZoom() + CLUSTER_ZOOM_STEP);
    map.setView(e.layer.getLatLng(), targetZoom, {animate: true});
  });

  S.plainGroup = L.layerGroup(); // used when clustering is toggled off
  S.clusteringOn = S.storedSettings.clustering !== false; // stored value only ever disables; unset/anything else defaults on
  document.getElementById('switch-clustering').classList.toggle('on', S.clusteringOn);
  map.addLayer(activeGroup());

  S.trailOn = S.storedSettings.trail !== false;
  document.getElementById('switch-trail').classList.toggle('on', S.trailOn);

  S.hotspotOn = S.storedSettings.hotspot !== false; // stored value only ever disables; unset/anything else defaults on
  document.getElementById('switch-hotspot').classList.toggle('on', S.hotspotOn);
  S.heatLayer = L.heatLayer([], {
    pane: 'heatPane', radius: 44, blur: 34, maxZoom: 15, minOpacity: 0.22, gradient: heatGradientForPalette(S.activePalette)
  });
  if(S.hotspotOn) map.addLayer(S.heatLayer);

  setupFilters();
  setupCompare();

  document.getElementById('toggle-settings').onclick = (e) => {
    const card = document.getElementById('settings-card');
    const opening = !card.classList.contains('show');
    closeOtherSidePanels('settings-card');
    card.classList.toggle('show', opening);
    e.currentTarget.classList.toggle('on', opening);
    S.updateSettingsScrollbar();
  };

  document.getElementById('switch-clustering').onclick = (e) => {
    const oldGroup = activeGroup();
    S.clusteringOn = !S.clusteringOn;
    const newGroup = activeGroup();

    S.activeSet.forEach(m => { oldGroup.removeLayer(m); newGroup.addLayer(m); });
    map.removeLayer(oldGroup);
    map.addLayer(newGroup);

    e.currentTarget.classList.toggle('on', S.clusteringOn);
    saveStoredSetting('clustering', S.clusteringOn);
  };

  wireRatingSettingsListeners();

  // ---- markers ----
  S.MAX_LIFETIME_VISITS = Math.max(1, ...data.map(shop => (shop.visited || []).length));

  S.shopMarkers = data.map((shop, i) => {
    const visitDaysForShop = (shop.visited || []).map(dateStr => {
      const t = new Date(dateStr).getTime();
      return isNaN(t) ? null : Math.floor(t / 86400000);
    }).filter(v => v !== null);
    const totalVisits = visitDaysForShop.length;
    return {
      shop,
      marker: makeMarkerFor(shop, i, totalVisits),
      // earliestDay still drives "Show Journey" (chronological, ignores the
      // date filter entirely) — visitDays is what the range filter uses.
      earliestDay: earliestVisit(shop) !== null ? Math.floor(earliestVisit(shop) / 86400000) : null,
      visitDays: visitDaysForShop,
      badgeCount: totalVisits
    };
  });
  S.activeSet = new Set();

  revealMarkers(POP_IN_BASE_WAIT);

  S.replayMarkerPopIn = popInVisibleMarkers;

  document.getElementById('switch-trail').onclick = (e) => {
    S.trailOn = !S.trailOn;
    e.currentTarget.classList.toggle('on', S.trailOn);
    saveStoredSetting('trail', S.trailOn);
    updateTrail();
  };

  document.getElementById('switch-hotspot').onclick = (e) => {
    S.hotspotOn = !S.hotspotOn;
    e.currentTarget.classList.toggle('on', S.hotspotOn);
    saveStoredSetting('hotspot', S.hotspotOn);
    if(S.hotspotOn){ map.addLayer(S.heatLayer); updateHeatLayer(); } else map.removeLayer(S.heatLayer);
  };

  wireJourneyListeners();

  map.on('click', hidePanel);
  map.on('moveend', updateInViewStats);
  setTimeout(() => map.invalidateSize(), 100);
}
