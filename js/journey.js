/* global L */
import { S } from './state.js';
import { haversineMiles } from './stats.js';
import { JOURNEY_MAX_ZOOM, JOURNEY_TYPE_LABELS, JOURNEY_TYPE_COLOR_VARS } from './constants.js';
import { updateHeatLayer, refreshWorldCopyMirrors } from './map.js';
import { updateInViewStats } from './stats.js';
import { applyFilters, setupCustomScrollbar } from './filters.js';

// ---- Sonny's Journey ----
// A curated, manually-paced tour through journey.json: fly tight-to-tight
// from one cafe to the next (Leaflet's own flyTo eases the zoom out and
// back in on its own for a long hop — that's the "the screen zooms out
// and back in" motion, driven by distance, not a deliberate step), stop,
// and open a story modal styled for that stop's type. Next/Back drive it;
// nothing auto-advances.

// Custom scrollbar for the story body, same track/thumb pattern as the
// coffee panel's #panel-scroll (setupCustomScrollbar in filters.js). Wired
// lazily on first render since the elements only need to exist by then.
let updateStoryScrollbar = null;

const EXTERNAL_LINK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>';

function escapeHtml(str){
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function monthLabel(ym){
  if(!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  if(!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {month:'short', year:'numeric'});
}
function dateRangeLabel(start, end){
  if(!start) return '';
  if(!end || end === start) return monthLabel(start);
  return `${monthLabel(start)} – ${monthLabel(end)}`;
}

// ---- resolving journey.json into playable stops ----
// Matches each journey.json entry to its cafe in coffee.json by exact
// (case-insensitive) name — that's how add-journey.html's autocomplete
// keeps them in sync — and quietly skips anything that doesn't match
// rather than breaking the whole journey over one typo'd cafe name.
export function resolveJourneyStops(rawEntries, shopMarkers){
  const stops = [];
  (rawEntries || []).forEach(entry => {
    const wanted = (entry.cafe || '').trim().toLowerCase();
    const shopEntry = shopMarkers.find(e => (e.shop.name || '').trim().toLowerCase() === wanted);
    if(!shopEntry){
      console.warn(`Sonny's Journey: no cafe in coffee.json matches "${entry.cafe}" for the "${entry.title || 'untitled'}" stop — skipping it.`);
      return;
    }
    stops.push({entry, shopEntry});
  });
  // Manual order (set in add-journey.html by dragging stops around) wins
  // when present; falls back to date order for any stop that predates the
  // order field, so older hand-edited journey.json files still work.
  stops.sort((a, b) => {
    const ao = typeof a.entry.order === 'number' ? a.entry.order : Infinity;
    const bo = typeof b.entry.order === 'number' ? b.entry.order : Infinity;
    if(ao !== bo) return ao - bo;
    const as = a.entry.dateStart || '', bs = b.entry.dateStart || '';
    if(as !== bs) return as.localeCompare(bs);
    return (a.entry.dateEnd || '').localeCompare(b.entry.dateEnd || '');
  });
  return stops;
}

// ---- the traveling arc between two stops (purely visual — camera motion
// is Leaflet's own flyTo, this line-draw never touches the map view) ----
function buildArc(fromLatLng, toLatLng, steps){
  const [lat1, lng1] = fromLatLng, [lat2, lng2] = toLatLng;
  const dLat = lat2 - lat1, dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if(dist === 0) return [[lat1, lng1], [lat2, lng2]];
  const midLat = (lat1 + lat2) / 2, midLng = (lng1 + lng2) / 2;
  const bulge = dist * 0.15;
  const ctrlLat = midLat + (-dLng / dist) * bulge;
  const ctrlLng = midLng + (dLat / dist) * bulge;
  const pts = [];
  for(let i = 0; i <= steps; i++){
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * ctrlLng + t * t * lng2;
    pts.push([lat, lng]);
  }
  return pts;
}

function populateStop(shopEntry){
  S.clusterGroup.addLayer(shopEntry.marker);
  S.activeSet.add(shopEntry.marker);
  updateHeatLayer();
  refreshWorldCopyMirrors();
  const el = shopEntry.marker.getElement();
  const bubble = el && el.querySelector('.bubble');
  if(bubble){
    bubble.classList.add('journey-active');
    setTimeout(() => bubble.classList.remove('journey-active'), 900);
  }
}

// One leg of the journey: flyTo carries the camera tight-to-tight (both
// ends target JOURNEY_MAX_ZOOM) between the two cafes; only once it has
// actually landed does the dashed travel line draw itself in. Drawing the
// line concurrently with flyTo (the old approach) raced Leaflet's own
// animation clock against a locally-estimated duration, and the two could
// drift out of sync (worse when marker-cluster redraws mid-flight perturbed
// the real flight) — hence the occasional buggy-looking crawl line.
// Resolves once the line has finished drawing.
function animateLeg(fromShopEntry, toShopEntry){
  return new Promise(resolve => {
    const fromShop = fromShopEntry.shop, toShop = toShopEntry.shop;
    const curve = buildArc([fromShop.lat, fromShop.lng], [toShop.lat, toShop.lng], 64);
    const distanceMi = haversineMiles(fromShop.lat, fromShop.lng, toShop.lat, toShop.lng);
    const flyDuration = Math.min(2600, 900 + Math.log(distanceMi + 1) * 300);
    const drawDuration = 450;

    S.map.flyTo([toShop.lat, toShop.lng], JOURNEY_MAX_ZOOM, {duration: flyDuration / 1000});

    let landed = false;
    function onLanded(){
      if(landed) return; // moveend + the timeout fallback can both fire
      landed = true;
      if(!S.journeyOn){ resolve(); return; }
      drawLine();
    }

    function drawLine(){
      const legLine = L.polyline([], {color:'rgba(59,42,30,0.6)', weight:2, dashArray:'5 7', lineCap:'round'}).addTo(S.map);
      S.journeyLines.push(legLine);
      const start = performance.now();
      function frame(now){
        if(!S.journeyOn){ resolve(); return; }
        const t = Math.min(1, (now - start) / drawDuration);
        const count = Math.max(2, Math.round(t * curve.length));
        legLine.setLatLngs(curve.slice(0, count));
        if(t < 1) S.journeyAnimFrame = requestAnimationFrame(frame);
        else resolve();
      }
      S.journeyAnimFrame = requestAnimationFrame(frame);
    }

    S.map.once('moveend', onLanded);
    // Safety net: flyTo should always fire moveend, but if something ever
    // interrupts it (another view change stomping this one) don't leave
    // the journey stuck waiting forever.
    setTimeout(onLanded, flyDuration + 400);
  });
}

// ---- story modal: content per stop type ----
// Every type shares the same shell (banner, title/meta, story text,
// links, Back/Next/progress footer) — see the story-* CSS. This function
// only builds the bit that differs: the "story-fields" block, and
// whether the slideshow section (research/paper only) is shown.
function typeFieldsHtml(stop){
  const type = stop.entry.type;
  const data = stop.entry[type] || {};

  if(type === 'education'){
    // Activities and courses render after the story text instead (see
    // afterFieldsHtml below) — only major/minor sits up here as a quick
    // subtitle-style tag before you've read anything.
    return data.majorMinor ? `<div class="story-chip-row"><span class="story-chip strong">${escapeHtml(data.majorMinor)}</span></div>` : '';
  }
  if(type === 'project'){
    const stack = data.stack || [];
    if(!stack.length) return '';
    return `<div class="story-chip-row">${stack.map(s => `<span class="story-chip">${escapeHtml(s)}</span>`).join('')}</div>`;
  }
  if(type === 'research'){
    let html = '';
    if(data.lab) html += `<div class="story-chip-row"><span class="story-chip strong">${escapeHtml(data.lab)}</span></div>`;
    if(data.finding) html += `<div class="story-callout"><b>Finding</b>${escapeHtml(data.finding)}</div>`;
    return html;
  }
  if(type === 'paper'){
    let html = '<div class="story-chip-row"><span class="story-chip strong">Publication</span></div>';
    if(data.venue) html += `<p class="story-meta" style="margin-top:-6px;">${escapeHtml(data.venue)}</p>`;
    if((data.authors || []).length) html += `<p class="story-meta" style="margin-top:-4px;">with ${escapeHtml(data.authors.join(', '))}</p>`;
    if(data.abstract) html += `<div class="story-callout"><b>Abstract, in short</b>${escapeHtml(data.abstract)}</div>`;
    return html;
  }
  if(type === 'internship'){
    let html = '';
    if(data.company) html += `<div class="story-chip-row"><span class="story-chip strong">${escapeHtml(data.company)}</span></div>`;
    if((data.bullets || []).length){
      html += '<ul class="story-bullets" style="list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:7px;">';
      data.bullets.forEach(b => {
        html += `<li style="font-size:12.5px; line-height:1.55; padding-left:14px; position:relative;"><span style="position:absolute; left:0; top:7px; width:5px; height:5px; border-radius:50%; background:var(--story-tint);"></span>${escapeHtml(b)}</li>`;
      });
      html += '</ul>';
    }
    return html;
  }
  return '';
}

// Content that renders AFTER the story text instead of before it —
// currently just the education stop's activities/courses lists, which
// read better as a follow-up to the story than as a header above it.
// Activities keep the same chip size/color as everything else
// (.story-chip); courses get their own smaller, differently-colored pill
// (.story-chip-course) so the two lists are visually distinct at a glance
// even though they sit right on top of each other.
function afterFieldsHtml(stop){
  const type = stop.entry.type;
  const data = stop.entry[type] || {};
  if(type !== 'education') return '';

  let html = '';
  const activities = data.activities || [];
  if(activities.length){
    html += `<div class="story-chip-row">${activities.map(a => `<span class="story-chip">${escapeHtml(a)}</span>`).join('')}</div>`;
  }
  const courses = data.courses || [];
  if(courses.length){
    html += `<div class="story-chip-row">${courses.map(c => `<span class="story-chip-course">${escapeHtml(c)}</span>`).join('')}</div>`;
  }
  return html;
}

function renderSlide(stop){
  const type = stop.entry.type;
  const slideshow = (stop.entry[type] && stop.entry[type].slideshow) || [];
  const imgEl = document.getElementById('story-slide-img');
  imgEl.src = slideshow[S.journeySlideIndex] || '';
  document.querySelectorAll('#story-slide-dots .dot').forEach((d, i) => d.classList.toggle('active', i === S.journeySlideIndex));
}

function renderStoryModal(){
  const stop = S.journeyStops[S.journeyIndex];
  if(!stop) return;
  const {entry, shopEntry} = stop;
  const type = entry.type;

  const banner = document.getElementById('story-banner');
  banner.style.setProperty('--story-tint', JOURNEY_TYPE_COLOR_VARS[type] || 'var(--tier-4)');
  const bannerImg = document.getElementById('story-banner-img');
  if(entry.banner){
    bannerImg.src = entry.banner;
    bannerImg.style.display = 'block';
  }else{
    bannerImg.style.display = 'none';
    bannerImg.src = '';
  }
  document.getElementById('story-kind').textContent = JOURNEY_TYPE_LABELS[type] || type;
  document.getElementById('story-place').textContent = entry.cafe || shopEntry.shop.name;

  document.getElementById('story-title').textContent = entry.title || '';
  const metaBits = [shopEntry.shop.area, shopEntry.shop.country].filter(Boolean).join(', ');
  document.getElementById('story-meta').textContent = [metaBits, dateRangeLabel(entry.dateStart, entry.dateEnd)].filter(Boolean).join(' · ');

  document.getElementById('story-fields').innerHTML = typeFieldsHtml(stop);

  const textEl = document.getElementById('story-text');
  textEl.textContent = entry.story || '';
  textEl.style.display = entry.story ? '' : 'none';

  document.getElementById('story-fields-after').innerHTML = afterFieldsHtml(stop);

  // slideshow — research/paper stops only
  const slideshow = (entry[type] && entry[type].slideshow) || [];
  const slideshowEl = document.getElementById('story-slideshow');
  if((type === 'research' || type === 'paper') && slideshow.length){
    slideshowEl.style.display = 'block';
    S.journeySlideIndex = 0;
    const dotsEl = document.getElementById('story-slide-dots');
    dotsEl.innerHTML = slideshow.map((_, i) => `<div class="dot" data-i="${i}"></div>`).join('');
    dotsEl.querySelectorAll('.dot').forEach(dot => {
      dot.onclick = () => { S.journeySlideIndex = parseInt(dot.dataset.i, 10); renderSlide(stop); };
    });
    document.getElementById('story-slide-prev').style.display = slideshow.length > 1 ? 'flex' : 'none';
    document.getElementById('story-slide-next').style.display = slideshow.length > 1 ? 'flex' : 'none';
    renderSlide(stop);
  }else{
    slideshowEl.style.display = 'none';
  }

  // pdf preview — paper stops only
  const pdfPath = (type === 'paper' && entry.paper && entry.paper.pdf) || '';
  const pdfEl = document.getElementById('story-pdf');
  const pdfFrameEl = document.getElementById('story-pdf-frame');
  if(pdfPath){
    pdfEl.style.display = 'block';
    pdfFrameEl.src = `${pdfPath}#toolbar=0&navpanes=0&view=FitH`;
    document.getElementById('story-pdf-filename').textContent = pdfPath.split('/').pop();
    document.getElementById('story-pdf-open').href = pdfPath;
    document.getElementById('story-pdf-expand').onclick = () => openPdfLightbox(pdfPath, entry.title);
  }else{
    pdfEl.style.display = 'none';
    pdfFrameEl.src = '';
  }

  const links = entry.links || [];
  document.getElementById('story-links').innerHTML = links.map(l =>
    `<a class="story-link-item" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${EXTERNAL_LINK_ICON}${escapeHtml(l.label || l.url)}</a>`
  ).join('');

  document.getElementById('story-progress-dots').innerHTML = S.journeyStops.map((_, i) =>
    `<div class="dot${i === S.journeyIndex ? ' active' : ''}"></div>`
  ).join('');
  const backBtn = document.getElementById('journey-back-btn');
  backBtn.classList.toggle('hidden', S.journeyIndex === 0);
  const nextBtn = document.getElementById('journey-next-btn');
  nextBtn.innerHTML = S.journeyIndex === S.journeyStops.length - 1 ? 'Done' : 'Next &#8250;';

  document.getElementById('journey-story-overlay').classList.add('show');
  document.getElementById('story-body').scrollTop = 0;
  if(!updateStoryScrollbar){
    updateStoryScrollbar = setupCustomScrollbar(
      document.getElementById('story-body'),
      document.getElementById('story-scrollbar-track'),
      document.getElementById('story-scrollbar-thumb')
    );
  }
  // content just changed (new stop's text/chips/slideshow), so the
  // scrollable height may have too — resync the thumb after layout settles.
  requestAnimationFrame(updateStoryScrollbar);
}

function closeStoryModal(){
  document.getElementById('journey-story-overlay').classList.remove('show');
  closePdfLightbox();
  closeGotoModal();
}

// ---- "go to a stop" modal: lets you jump straight to any stop instead of
// stepping through with Back/Next. A real top-level overlay (not a
// popover anchored to the story card) so a long list of stops always has
// room, instead of getting clipped near the button. ----
function renderGotoList(){
  const listEl = document.getElementById('goto-list');
  listEl.innerHTML = S.journeyStops.map((stop, i) => {
    const e = stop.entry;
    const color = JOURNEY_TYPE_COLOR_VARS[e.type] || 'var(--dim)';
    return `
      <div class="story-goto-item${i === S.journeyIndex ? ' current' : ''}" data-index="${i}">
        <span class="story-goto-num">${i + 1}</span>
        <span class="story-goto-dot" style="background:${color}"></span>
        <span class="story-goto-info">
          <div class="story-goto-title">${escapeHtml(e.title || '(untitled)')}</div>
          <div class="story-goto-meta">${escapeHtml(e.cafe || '?')} &middot; ${dateRangeLabel(e.dateStart, e.dateEnd)}</div>
        </span>
      </div>`;
  }).join('');
  listEl.querySelectorAll('.story-goto-item').forEach(item => {
    item.onclick = () => {
      const idx = parseInt(item.dataset.index, 10);
      closeGotoModal();
      if(idx !== S.journeyIndex) goToStop(idx);
    };
  });
}
function openGotoModal(){
  renderGotoList();
  document.getElementById('goto-overlay').classList.add('show');
}
function closeGotoModal(){
  const overlay = document.getElementById('goto-overlay');
  if(!overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
}

// ---- pdf lightbox: fullscreen expand of the current stop's paper PDF ----
function openPdfLightbox(pdfPath, title){
  document.getElementById('pdf-lightbox-frame').src = pdfPath;
  document.getElementById('pdf-lightbox-title').textContent = title || 'Paper';
  document.getElementById('pdf-lightbox-overlay').classList.add('show');
}
function closePdfLightbox(){
  const overlay = document.getElementById('pdf-lightbox-overlay');
  if(!overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  document.getElementById('pdf-lightbox-frame').src = '';
}

// Flies to (or back to) the stop at newIndex, then opens its story modal.
async function goToStop(newIndex){
  if(!S.journeyOn || newIndex < 0 || newIndex >= S.journeyStops.length) return;
  const from = S.journeyStops[S.journeyIndex];
  const to = S.journeyStops[newIndex];
  closeStoryModal();
  await animateLeg(from.shopEntry, to.shopEntry);
  if(!S.journeyOn) return;
  S.journeyIndex = newIndex;
  populateStop(to.shopEntry); // no-op if already on the map (e.g. stepping Back) — addLayer/Set are idempotent
  renderStoryModal();
}

export function startJourney(){
  if(S.journeyOn) return;
  // journey.json empty, or nothing in it matched a cafe in coffee.json —
  // resolveJourneyStops() already logged why to the console; here it just
  // means the toggle/button quietly do nothing, same as before they were
  // enabled (see the eligibility check in map.js's initApp).
  if(!S.journeyStops.length) return;

  S.journeyOn = true;
  S.journeyIndex = 0;
  document.getElementById('toggle-journey').classList.add('on');
  document.body.classList.add('journey-mode');
  S.scrubberEl.style.display = 'none';

  S.clusterGroup.clearLayers();
  // clearLayers() wipes leaflet.markercluster's internal bookkeeping for
  // every layer it was tracking, including repeated-world-copy mirror
  // clones — clear our own parallel bookkeeping of those (entry.mirrors)
  // too, or a later refreshWorldCopyMirrors() would try to remove a
  // mirror the cluster group no longer has any record of and throw.
  S.shopMarkers.forEach(entry => entry.mirrors.clear());
  S.activeSet = new Set();
  updateHeatLayer();
  refreshWorldCopyMirrors();
  S.currentVisible = [];
  if(S.trailLine){ S.map.removeLayer(S.trailLine); S.trailLine = null; }
  updateInViewStats();

  const first = S.journeyStops[0];
  S.map.flyTo([first.shopEntry.shop.lat, first.shopEntry.shop.lng], JOURNEY_MAX_ZOOM, {duration:0.6});
  setTimeout(() => {
    if(!S.journeyOn) return;
    populateStop(first.shopEntry);
    renderStoryModal();
  }, 650);
}

export function stopJourney(){
  if(!S.journeyOn) return;
  S.journeyOn = false;
  document.body.classList.remove('journey-mode');
  closeStoryModal();
  if(S.journeyAnimFrame) cancelAnimationFrame(S.journeyAnimFrame);
  S.journeyLines.forEach(l => S.map.removeLayer(l));
  S.journeyLines = [];
  document.querySelectorAll('.bubble.journey-active').forEach(el => el.classList.remove('journey-active'));
  document.getElementById('toggle-journey').classList.remove('on');
  if(S.scrubberShouldShow) S.scrubberEl.style.display = 'block';
  applyFilters(); // resync the map back to whatever filters/date range are actually active
}

export function wireJourneyListeners(){
  document.getElementById('toggle-journey').onclick = () => {
    if(S.journeyOn) stopJourney();
    else startJourney();
  };
  document.getElementById('journey-exit-btn').onclick = stopJourney;
  document.getElementById('journey-back-btn').onclick = () => goToStop(S.journeyIndex - 1);
  document.getElementById('journey-next-btn').onclick = () => {
    if(S.journeyIndex >= S.journeyStops.length - 1) stopJourney();
    else goToStop(S.journeyIndex + 1);
  };
  document.getElementById('story-slide-prev').onclick = () => {
    const stop = S.journeyStops[S.journeyIndex];
    const slideshow = (stop.entry[stop.entry.type] && stop.entry[stop.entry.type].slideshow) || [];
    if(!slideshow.length) return;
    S.journeySlideIndex = (S.journeySlideIndex - 1 + slideshow.length) % slideshow.length;
    renderSlide(stop);
  };
  document.getElementById('story-slide-next').onclick = () => {
    const stop = S.journeyStops[S.journeyIndex];
    const slideshow = (stop.entry[stop.entry.type] && stop.entry[stop.entry.type].slideshow) || [];
    if(!slideshow.length) return;
    S.journeySlideIndex = (S.journeySlideIndex + 1) % slideshow.length;
    renderSlide(stop);
  };

  document.getElementById('pdf-lightbox-close').onclick = closePdfLightbox;
  document.getElementById('pdf-lightbox-overlay').addEventListener('click', e => {
    if(e.target.id === 'pdf-lightbox-overlay') closePdfLightbox();
  });

  document.getElementById('story-goto-btn').onclick = openGotoModal;
  document.getElementById('goto-close').onclick = closeGotoModal;
  document.getElementById('goto-overlay').addEventListener('click', e => {
    if(e.target.id === 'goto-overlay') closeGotoModal();
  });

  document.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      closePdfLightbox();
      closeGotoModal();
    }
  });
}
