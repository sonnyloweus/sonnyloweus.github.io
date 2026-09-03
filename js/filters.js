import { S } from './state.js';
import { formatDay, earliestVisit } from './data.js';
import { syncBadgeCountsAndGetActive, activeGroup, refreshDependentUI } from './map.js';
import { closeOtherSidePanels } from './panel.js';
import { smoothOpenPath } from './radar.js';

// days (floored to UTC day number) for every visit belonging to a given
// list of shops — shared by the full-dataset histogram and the
// in-viewport recompute below.
export function daysFromShops(shops){
  return shops.flatMap(shop => (shop.visited || []).map(dateStr => {
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? null : Math.floor(t / 86400000);
  })).filter(v => v !== null);
}

export function dayToPct(day){ return S.maxDay === S.minDay ? 0 : (day - S.minDay) / (S.maxDay - S.minDay); }
export function pctToDay(p){ return Math.round(S.minDay + p * (S.maxDay - S.minDay)); }

export function updateHandles(){
  const loP = dayToPct(S.lowDay) * 100, hiP = dayToPct(S.highDay) * 100;
  S.handleLow.style.left = loP + '%';
  S.handleHigh.style.left = hiP + '%';
  S.fillEl.style.left = loP + '%';
  S.fillEl.style.width = (hiP - loP) + '%';
  // Very light wash across the selected band, sitting between the plot and
  // the handles (see .range-highlight in styles.css) — same loP/hiP as
  // everything else here, just one more element to keep positioned.
  const highlightEl = document.getElementById('range-highlight');
  if (highlightEl){
    highlightEl.style.left = loP + '%';
    highlightEl.style.width = (hiP - loP) + '%';
  }
  document.getElementById('scrubber-lo').textContent = formatDay(S.lowDay);
  document.getElementById('scrubber-hi').textContent = formatDay(S.highDay);
  updateHistogramRange();
}

// ---- visit-frequency "rug + density" plot, merged with the drag handles ----
// A density mound for the given shops' visit days (defaults to the whole
// dataset, but updateInViewStats() re-renders this with only the shops
// currently on-screen every time the map pans/zooms or a filter changes),
// with a rug tick for every individual visit day in a separate band just
// below it — a small fixed gap keeps the two from touching. The x-axis
// (dayToPct, driven by the full dataset's minDay/maxDay) stays fixed
// either way, so the timeline itself doesn't rescale as you pan.
//
// The drag handles themselves are plain DOM elements (#handle-low/#handle-
// high, styled in styles.css) absolutely positioned on top of this SVG —
// see the .visit-hist-wrap / #range-slider rules — so this module doesn't
// need to know anything about them beyond the [lowDay, highDay] values
// that decide what's dimmed.
//
// The current [lowDay, highDay] selection is drawn at full strength (both
// the mound, via a clip-path rect, and the individual rug ticks);
// everything outside it is dimmed — so the shape doubles as a live preview
// of what dragging the handles will include. updateHistogramRange() below
// only moves that clip rect and toggles tick classes, so dragging the
// handles never needs a full re-render.
const VISIT_CURVE_BUCKETS = 48; // resolution of the smoothed mound — independent of how many days the full range spans
const VISIT_PLOT_W = 300;
const VISIT_PLOT_BASELINE = 34; // bottom of the density mound
const VISIT_PLOT_AMP = 26;      // mound peak height above the baseline
const VISIT_PLOT_GAP = 3;       // clear air between the mound's baseline and the rug band
const VISIT_PLOT_RUG_TOP = VISIT_PLOT_BASELINE + VISIT_PLOT_GAP;
const VISIT_PLOT_RUG_BOTTOM = VISIT_PLOT_RUG_TOP + 6;
const VISIT_PLOT_H = VISIT_PLOT_RUG_BOTTOM + 3;

function bucketVisitDays(days){
  const buckets = new Array(VISIT_CURVE_BUCKETS).fill(0);
  const span = Math.max(1, S.maxDay - S.minDay);
  days.forEach(day => {
    const idx = Math.min(VISIT_CURVE_BUCKETS - 1, Math.max(0, Math.floor(((day - S.minDay) / span) * VISIT_CURVE_BUCKETS)));
    buckets[idx]++;
  });
  return buckets;
}

function fractionsFor(buckets, n){
  return n ? buckets.map(c => c / n) : buckets.map(() => 0);
}

export function renderVisitHistogram(shops){
  const histEl = document.getElementById('visit-hist');
  if(!histEl) return;
  if(!S.scrubberShouldShow){ histEl.style.display = 'none'; return; }

  const days = daysFromShops(shops || S.GLOBAL_DATA);
  if(!days.length){ histEl.innerHTML = ''; histEl.style.display = 'block'; return; }

  const buckets = bucketVisitDays(days);
  const fractions = fractionsFor(buckets, days.length);
  const maxFrac = Math.max(1e-6, ...fractions);
  const centers = fractions.map((_, i) => ((i + 0.5) / VISIT_CURVE_BUCKETS) * VISIT_PLOT_W);
  const yOf = f => VISIT_PLOT_BASELINE - (f / maxFrac) * VISIT_PLOT_AMP;

  const line = smoothOpenPath(
    [[0, VISIT_PLOT_BASELINE], ...centers.map((x, i) => [x, yOf(fractions[i])]), [VISIT_PLOT_W, VISIT_PLOT_BASELINE]],
    0.65
  );
  const area = line + ` L ${VISIT_PLOT_W},${VISIT_PLOT_BASELINE} L 0,${VISIT_PLOT_BASELINE} Z`;

  const rugTicks = days.map(day => {
    const x = (dayToPct(day) * VISIT_PLOT_W).toFixed(1);
    const on = day >= S.lowDay && day <= S.highDay;
    return `<line class="visit-rug-tick${on ? ' in-range' : ''}" data-day="${day}" x1="${x}" y1="${VISIT_PLOT_RUG_TOP}" x2="${x}" y2="${VISIT_PLOT_RUG_BOTTOM}"/>`;
  }).join('');

  const loFrac = dayToPct(S.lowDay), hiFrac = dayToPct(S.highDay);

  histEl.innerHTML = `<svg viewBox="0 0 ${VISIT_PLOT_W} ${VISIT_PLOT_H}" preserveAspectRatio="none">
    <clipPath id="visit-hist-range-clip" clipPathUnits="objectBoundingBox">
      <rect id="visit-hist-range-clip-rect" x="${loFrac}" y="0" width="${Math.max(0, hiFrac - loFrac)}" height="1"/>
    </clipPath>
    <path class="visit-hist-area-dim" d="${area}"/>
    <path class="visit-hist-area-focus" d="${area}" clip-path="url(#visit-hist-range-clip)"/>
    <g>${rugTicks}</g>
  </svg>`;

  histEl.style.display = 'block';
  updateHistogramRange();
}

export function updateHistogramRange(){
  const histEl = document.getElementById('visit-hist');
  if(!histEl) return;
  const clipRect = histEl.querySelector('#visit-hist-range-clip-rect');
  if (clipRect){
    const loFrac = dayToPct(S.lowDay), hiFrac = dayToPct(S.highDay);
    clipRect.setAttribute('x', loFrac);
    clipRect.setAttribute('width', Math.max(0, hiFrac - loFrac));
  }
  histEl.querySelectorAll('.visit-rug-tick').forEach(tick => {
    const day = parseFloat(tick.dataset.day);
    tick.classList.toggle('in-range', day >= S.lowDay && day <= S.highDay);
  });
}

export function makeDraggable(handle, isLow){
  handle.addEventListener('pointerdown', e => {
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const rect = S.sliderEl.getBoundingClientRect();
      let p = (ev.clientX - rect.left) / rect.width;
      p = Math.min(1, Math.max(0, p));
      let day = pctToDay(p);
      if(isLow){ S.lowDay = Math.min(day, S.highDay); }
      else { S.highDay = Math.max(day, S.lowDay); }
      updateHandles();
      applyFilters();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

export function renderYearTicks(){
  const ticksEl = document.getElementById('range-ticks');
  const minYear = new Date(S.minDay * 86400000).getUTCFullYear();
  const maxYear = new Date(S.maxDay * 86400000).getUTCFullYear();
  let html = '';
  for(let y = minYear; y <= maxYear; y++){
    const jan1Day = Math.round(Date.UTC(y, 0, 1) / 86400000);
    if(jan1Day >= S.minDay && jan1Day <= S.maxDay){
      const pct = dayToPct(jan1Day) * 100;
      html += `<div class="range-tick" style="left:${pct}%"></div><div class="range-tick-label" style="left:${pct}%">${y}</div>`;
    }
    // Unlabeled mid-year tick (Jul 1) so the scale reads evenly between
    // the labeled year marks instead of leaving a long bare stretch.
    const jul1Day = Math.round(Date.UTC(y, 6, 1) / 86400000);
    if(jul1Day >= S.minDay && jul1Day <= S.maxDay){
      const pct = dayToPct(jul1Day) * 100;
      html += `<div class="range-tick minor" style="left:${pct}%"></div>`;
    }
  }
  ticksEl.innerHTML = html;
}

export function updateRatingHandles(){
  const loP = (S.filters.ratingLow/5)*100, hiP = (S.filters.ratingHigh/5)*100;
  S.ratingHandleLow.style.left = loP + '%';
  S.ratingHandleHigh.style.left = hiP + '%';
  S.ratingFillEl.style.left = loP + '%';
  S.ratingFillEl.style.width = (hiP - loP) + '%';
  document.getElementById('rating-lo').textContent = S.filters.ratingLow.toFixed(1);
  document.getElementById('rating-hi').textContent = S.filters.ratingHigh.toFixed(1);
}
export function makeRatingDraggable(handle, isLow){
  handle.addEventListener('pointerdown', e => {
    handle.setPointerCapture(e.pointerId);
    const move = ev => {
      const rect = S.ratingSliderEl.getBoundingClientRect();
      let p = (ev.clientX - rect.left) / rect.width;
      p = Math.min(1, Math.max(0, p));
      let val = Math.round(p * 5 * 10) / 10;
      if(isLow){ S.filters.ratingLow = Math.min(val, S.filters.ratingHigh); }
      else { S.filters.ratingHigh = Math.max(val, S.filters.ratingLow); }
      updateRatingHandles();
      updateFilterDot();
      applyFilters();
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}

// ---- custom scrollbar, shared by the filter and settings panels ----
// Built by hand instead of styling the native one: native scrollbars
// can't be reliably clipped to a rounded container across browsers (the
// old thumb poked out past the corners at the ends of its travel), and
// Chrome (~121+) stopped letting a styled ::-webkit-scrollbar disable its
// auto-hiding overlay scrollbar, so "always visible" isn't achievable by
// styling the real one there either. This one is fully within our
// control: sized/positioned in JS off the real scroll state, and
// draggable like the site's other custom sliders. setupCustomScrollbar
// wires up one scroll/track/thumb triplet and returns its update function
// so callers (e.g. a panel-open handler) can force a resync on demand.
export function setupCustomScrollbar(scrollEl, trackEl, thumbEl){
  if(!scrollEl || !trackEl || !thumbEl) return () => {};

  function update(){
    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    const scrollable = scrollHeight - clientHeight > 1;
    trackEl.classList.toggle('visible', scrollable);
    if(!scrollable) return;
    const trackHeight = trackEl.clientHeight;
    const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight);
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * maxThumbTop : 0;
    thumbEl.style.height = thumbHeight + 'px';
    thumbEl.style.top = thumbTop + 'px';
  }
  scrollEl.addEventListener('scroll', update);
  // Height depends on viewport (see the min()/calc() in .filter-scroll), so
  // recompute whenever that can change, not just when content changes.
  if('ResizeObserver' in window){
    new ResizeObserver(update).observe(scrollEl);
  }else{
    window.addEventListener('resize', update);
  }
  update();

  thumbEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    thumbEl.setPointerCapture(e.pointerId);
    thumbEl.classList.add('dragging');
    const startY = e.clientY;
    const startScrollTop = scrollEl.scrollTop;
    const trackHeight = trackEl.clientHeight;
    const thumbHeight = thumbEl.clientHeight;
    const maxThumbTravel = Math.max(1, trackHeight - thumbHeight);
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
    const move = ev => {
      const dy = ev.clientY - startY;
      const scrollDelta = (dy / maxThumbTravel) * maxScroll;
      scrollEl.scrollTop = Math.min(maxScroll, Math.max(0, startScrollTop + scrollDelta));
    };
    const up = () => {
      thumbEl.classList.remove('dragging');
      thumbEl.removeEventListener('pointermove', move);
      thumbEl.removeEventListener('pointerup', up);
    };
    thumbEl.addEventListener('pointermove', move);
    thumbEl.addEventListener('pointerup', up);
  });

  return update;
}

export function filtersActive(){
  return S.filters.ratingLow > 0 || S.filters.ratingHigh < 5 || S.filters.prices.size > 0 || S.filters.tags.size > 0;
}
export function updateFilterDot(){
  const btn = document.getElementById('toggle-filter');
  const existing = btn.querySelector('.filter-dot');
  if(filtersActive() && !existing){
    btn.insertAdjacentHTML('beforeend', '<span class="filter-dot"></span>');
  }else if(!filtersActive() && existing){
    existing.remove();
  }
}

export function updateSearchDot(){
  const btn = document.getElementById('toggle-search');
  const existing = btn.querySelector('.filter-dot');
  if(S.filters.search && !existing){
    btn.insertAdjacentHTML('beforeend', '<span class="filter-dot"></span>');
  }else if(!S.filters.search && existing){
    existing.remove();
  }
}

export function passesNonDateFilters(shop){
  if(shop.overall < S.filters.ratingLow || shop.overall > S.filters.ratingHigh) return false;
  if(S.filters.prices.size && !S.filters.prices.has(shop.price)) return false;
  if(S.filters.tags.size && !(shop.tags||[]).some(t => S.filters.tags.has(t))) return false;
  if(S.filters.search){
    const q = S.filters.search;
    const hay = `${shop.name} ${shop.area||''} ${shop.country||''}`.toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}

// Lightweight: only adds/removes the markers whose membership actually
// changed, instead of clearing and rebuilding every pill on the map. Used
// for every filter/date-range/clustering-toggle change after the initial
// reveal — those should feel instant, not staggered.
export function applyFilters(){
  const activeEntries = syncBadgeCountsAndGetActive();
  const nextActive = new Set(activeEntries.map(e => e.marker));
  const toAdd = activeEntries.filter(e => !S.activeSet.has(e.marker)).map(e => e.marker);
  const toRemove = [];
  S.activeSet.forEach(m => { if(!nextActive.has(m)) toRemove.push(m); });

  if(toAdd.length) toAdd.forEach(m => activeGroup().addLayer(m));
  if(toRemove.length) toRemove.forEach(m => activeGroup().removeLayer(m));
  S.activeSet = nextActive;

  refreshDependentUI();
}

// ---- Wires up everything in this module that touches the DOM: the date
// range scrubber + histogram, the rating range slider, price/tag chips,
// the filter/settings/compare custom scrollbars, filter-dot/search-dot,
// and the reset/search controls. Mirrors the original init()'s top-to-
// bottom order for this section. Called once from map.js's initApp(),
// after the map/cluster/heat layers exist but before markers are built. ----
export function setupFilters(){
  // ---- date range (dual handle) ----
  // visitDays: one entry per shop (its first visit) — used only to decide
  // whether the scrubber has enough spread to bother showing.
  S.visitDays = S.GLOBAL_DATA.map(earliestVisit).filter(v => v !== null).map(v => Math.floor(v / 86400000));
  // allVisitDays: every visit of every shop — this is the real span of
  // activity, and it's what the histogram buckets and the slider's own
  // min/max are built from. (Using only first-visit days here would clip
  // off later revisits to a place discovered after everything else.)
  S.allVisitDays = daysFromShops(S.GLOBAL_DATA);
  S.minDay = S.allVisitDays.length ? Math.min(...S.allVisitDays) : 0;
  S.maxDay = S.allVisitDays.length ? Math.max(...S.allVisitDays) : 0;
  S.lowDay = S.minDay; S.highDay = S.maxDay;

  S.scrubberEl = document.getElementById('scrubber');
  S.sliderEl = document.getElementById('range-slider');
  S.fillEl = document.getElementById('range-fill');
  S.handleLow = document.getElementById('handle-low');
  S.handleHigh = document.getElementById('handle-high');

  S.scrubberShouldShow = S.visitDays.length > 1 && S.minDay !== S.maxDay;
  if(S.scrubberShouldShow){
    S.scrubberEl.style.display = 'block';
    updateHandles();
    renderYearTicks();
    renderVisitHistogram();
    makeDraggable(S.handleLow, true);
    makeDraggable(S.handleHigh, false);
  }

  // ---- rating range (filter panel) ----
  S.ratingSliderEl = document.getElementById('rating-slider');
  S.ratingFillEl = document.getElementById('rating-fill');
  S.ratingHandleLow = document.getElementById('rating-handle-low');
  S.ratingHandleHigh = document.getElementById('rating-handle-high');

  updateRatingHandles();
  makeRatingDraggable(S.ratingHandleLow, true);
  makeRatingDraggable(S.ratingHandleHigh, false);

  // ---- price + tag chips, built from whatever's actually in the data ----
  const allPrices = [...new Set(S.GLOBAL_DATA.map(s => s.price).filter(Boolean))].sort((a,b) => a.length - b.length);
  const allTags = [...new Set(S.GLOBAL_DATA.flatMap(s => s.tags || []))].sort();

  const priceChipsEl = document.getElementById('price-chips');
  allPrices.forEach(price => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = price;
    chip.onclick = () => {
      if(S.filters.prices.has(price)) S.filters.prices.delete(price); else S.filters.prices.add(price);
      chip.classList.toggle('active');
      updateFilterDot();
      applyFilters();
    };
    priceChipsEl.appendChild(chip);
  });

  const tagChipsEl = document.getElementById('tag-chips');
  allTags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = tag;
    chip.onclick = () => {
      if(S.filters.tags.has(tag)) S.filters.tags.delete(tag); else S.filters.tags.add(tag);
      chip.classList.toggle('active');
      updateFilterDot();
      applyFilters();
    };
    tagChipsEl.appendChild(chip);
  });

  const updateFilterScrollbar = setupCustomScrollbar(
    document.getElementById('filter-scroll'),
    document.getElementById('filter-scrollbar-track'),
    document.getElementById('filter-scrollbar-thumb')
  );
  // Read elsewhere via S.updateSettingsScrollbar / S.updateCompareScrollbar /
  // S.updatePanelScrollbar — see their placeholder declarations in state.js.
  S.updateSettingsScrollbar = setupCustomScrollbar(
    document.getElementById('settings-scroll'),
    document.getElementById('settings-scrollbar-track'),
    document.getElementById('settings-scrollbar-thumb')
  );
  S.updateCompareScrollbar = setupCustomScrollbar(
    document.getElementById('compare-scroll'),
    document.getElementById('compare-scrollbar-track'),
    document.getElementById('compare-scrollbar-thumb')
  );
  S.updatePanelScrollbar = setupCustomScrollbar(
    document.getElementById('panel-scroll'),
    document.getElementById('panel-scrollbar-track'),
    document.getElementById('panel-scrollbar-thumb')
  );
  S.updateStatsScrollbar = setupCustomScrollbar(
    document.getElementById('stats-scroll'),
    document.getElementById('stats-scrollbar-track'),
    document.getElementById('stats-scrollbar-thumb')
  );

  document.getElementById('filter-reset').onclick = () => {
    S.filters = { ratingLow: 0, ratingHigh: 5, prices: new Set(), tags: new Set(), search: S.filters.search };
    updateRatingHandles();
    document.querySelectorAll('#price-chips .chip, #tag-chips .chip').forEach(c => c.classList.remove('active'));
    updateFilterDot();
    applyFilters();
  };

  document.getElementById('toggle-search').onclick = (e) => {
    const pill = e.currentTarget;
    const input = document.getElementById('search-input');
    if(e.target === input) return; // clicking into the box just places the caret
    if(e.target.closest('.search-clear')) return; // handled by its own listener
    const expanded = pill.classList.toggle('expanded');
    if(expanded){
      input.focus();
    }else{
      input.blur();
      if(input.value){
        input.value = '';
        S.filters.search = '';
        pill.classList.remove('has-text');
        updateSearchDot();
        applyFilters();
      }
    }
  };

  document.getElementById('search-input').addEventListener('input', (e) => {
    S.filters.search = e.target.value.trim().toLowerCase();
    document.getElementById('toggle-search').classList.toggle('has-text', !!e.target.value);
    updateSearchDot();
    applyFilters();
  });

  document.getElementById('search-clear').addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.getElementById('search-input');
    const pill = document.getElementById('toggle-search');
    input.value = '';
    S.filters.search = '';
    pill.classList.remove('has-text');
    updateSearchDot();
    applyFilters();
    input.focus();
  });

  document.getElementById('toggle-filter').onclick = (e) => {
    const card = document.getElementById('filter-card');
    const opening = !card.classList.contains('show');
    closeOtherSidePanels('filter-card');
    card.classList.toggle('show', opening);
    e.currentTarget.classList.toggle('on', opening);
    updateFilterScrollbar();
  };

  return { updateFilterScrollbar };
}
