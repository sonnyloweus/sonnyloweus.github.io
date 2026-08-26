import { S } from './state.js';
import { displayRating } from './data.js';
import { renderShopRadar } from './radar.js';
import { syncGameSubmitButton } from './game.js';
import { buildBubbleIcon } from './map.js';
import { updateInViewStats } from './stats.js';
import { renderCompare } from './compare.js';

// Note: map.js, stats.js, and compare.js all import from panel.js in turn
// (closeOtherSidePanels, hidePanel, etc.), so these are circular module
// imports. That's fine in ES modules as long as nothing here touches the
// imported bindings until a function is actually called at runtime (well
// after the whole module graph has finished evaluating) — which is the
// case for every usage below.

// Returns this shop's photos newest-first, whether it uses the new `photos`
// array (each {src, date}) or the older single `photo` string.
export function getShopPhotos(shop){
  const list = shop.photos && shop.photos.length
    ? shop.photos.slice()
    : (shop.photo ? [{src: shop.photo}] : []);
  return list.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da; // newest first
  });
}

export function renderPanelPhoto(){
  const photoImg = document.getElementById('p-photo');
  const dotsEl = document.getElementById('p-photo-dots');
  if(!S.panelPhotos.length){
    photoImg.src = '';
    dotsEl.innerHTML = '';
    return;
  }
  photoImg.src = S.panelPhotos[S.panelPhotoIndex].src;
  dotsEl.innerHTML = '';
  if(S.panelPhotos.length > 1){
    S.panelPhotos.forEach((p, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === S.panelPhotoIndex ? ' active' : '');
      dot.onclick = (e) => { e.stopPropagation(); S.panelPhotoIndex = i; renderPanelPhoto(); };
      dotsEl.appendChild(dot);
    });
  }
}

export function setupPanelPhotoNav(){
  const wrap = document.getElementById('p-photo-wrap');
  let touchStartX = null;
  let suppressClick = false;

  wrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, {passive:true});
  wrap.addEventListener('touchend', e => {
    if(touchStartX === null || !S.panelPhotos.length){ touchStartX = null; return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if(Math.abs(dx) < 30) return; // treat as a tap, let the click handler below decide left/right
    suppressClick = true; // this was a swipe — don't also fire the tap-nav click handler
    S.panelPhotoIndex = dx < 0
      ? (S.panelPhotoIndex + 1) % S.panelPhotos.length
      : (S.panelPhotoIndex - 1 + S.panelPhotos.length) % S.panelPhotos.length;
    renderPanelPhoto();
  }, {passive:true});

  // Click (or tap) the left/right half of the photo to go to the previous/next
  // one — handy on a laptop where there's no swipe gesture. Dots (which stop
  // propagation) still work exactly as before.
  wrap.addEventListener('click', e => {
    if(suppressClick){ suppressClick = false; return; }
    if(S.panelPhotos.length <= 1) return;
    const rect = wrap.getBoundingClientRect();
    const clickedLeftHalf = (e.clientX - rect.left) < rect.width / 2;
    S.panelPhotoIndex = clickedLeftHalf
      ? (S.panelPhotoIndex - 1 + S.panelPhotos.length) % S.panelPhotos.length
      : (S.panelPhotoIndex + 1) % S.panelPhotos.length;
    renderPanelPhoto();
  });
}

// Pulled out of showPanel so the "Normalize ratings" toggle can refresh just
// the overall-rating bits of an already-open panel without resetting the
// photo carousel or anything else showPanel would otherwise re-render.
export function updatePanelRatingFields(shop){
  const el = document.getElementById('p-rating');
  if(el) el.textContent = displayRating(shop.overall).toFixed(1);
  const radarEl = document.getElementById('p-radar');
  if(radarEl) radarEl.innerHTML = renderShopRadar(shop);
}

export function showPanel(shop){
  S.lastShownShop = shop;
  S.panelPhotos = getShopPhotos(shop);
  S.panelPhotoIndex = 0;
  renderPanelPhoto();
  document.getElementById('p-photo-wrap').style.display = S.panelPhotos.length ? 'block' : 'none';
  document.getElementById('panel-header').classList.toggle('no-photo', !S.panelPhotos.length);
  document.getElementById('p-name').textContent = shop.name;
  document.getElementById('p-area').textContent = shop.country ? `${shop.area} · ${shop.country}` : shop.area;
  document.getElementById('p-maps-link').href = shop.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`;

  const metaParts = [];
  if(shop.price) metaParts.push(shop.price);
  if(shop.visited && shop.visited.length){
    if(shop.visited.length <= 4){
      metaParts.push('Visited ' + shop.visited.join(', '));
    }else{
      const sorted = [...shop.visited].sort((a,b) => new Date(a) - new Date(b));
      metaParts.push(`${shop.visited.length} visits · first ${sorted[0]} · latest ${sorted[sorted.length-1]}`);
    }
  }
  document.getElementById('p-meta').textContent = metaParts.join('  ·  ');

  updatePanelRatingFields(shop);

  document.getElementById('p-radar').innerHTML = renderShopRadar(shop);

  document.getElementById('p-note').textContent = shop.note;
  const storyEl = document.getElementById('p-story');
  if(shop.story){
    storyEl.textContent = shop.story;
    storyEl.style.display = 'block';
  }else{
    storyEl.style.display = 'none';
  }
  document.getElementById('p-tags').textContent = shop.tags.join('  ·  ');
  document.getElementById('panel').classList.add('show');
  // New shop's content is a different length every time — start scrolled to
  // the top and resync the thumb to match, rather than carrying over the
  // last shop's scroll position/thumb size.
  document.getElementById('panel-scroll').scrollTop = 0;
  S.updatePanelScrollbar();
  syncGameSubmitButton();
}
export function hidePanel(){ document.getElementById('panel').classList.remove('show'); S.lastShownShop = null; }

// Filter / compare / settings share one "slot" — opening one should close
// whichever of the other two is currently open, rather than stacking.
export function closeOtherSidePanels(exceptCardId){
  [['filter-card','toggle-filter'], ['compare-card','toggle-compare'], ['settings-card','toggle-settings']]
    .forEach(([cardId, toggleId]) => {
      if(cardId === exceptCardId) return;
      document.getElementById(cardId).classList.remove('show');
      document.getElementById(toggleId).classList.remove('on');
    });
}

// Re-draws everything whose look depends on shop.overall: every pin icon
// (via buildBubbleIcon, which already reads NORMALIZE_RATINGS internally),
// any active clusters, the stats panel, the open detail panel (if any),
// and the compare card (if open) — same values, just re-rendered.
export function refreshRatingDependentUI(){
  S.shopMarkers.forEach(entry => {
    entry.marker.setIcon(buildBubbleIcon(entry.shop, entry.badgeCount, { animate: false }));
  });
  if(S.clusterGroup.refreshClusters) S.clusterGroup.refreshClusters();
  updateInViewStats();
  if(S.lastShownShop) updatePanelRatingFields(S.lastShownShop);
  if(document.getElementById('compare-card').classList.contains('show')) renderCompare();
}

// Small standalone UI wiring that doesn't belong to any one feature area —
// the panel close button, the brand/stats dropdown toggle, the correlation
// help tooltip, and the "on this day" banner's close button.
export function wirePanelListeners(){
  document.getElementById('p-close').onclick = hidePanel;

  document.getElementById('brand').onclick = () => {
    document.getElementById('stats-card').classList.toggle('show');
    document.getElementById('brand').classList.toggle('open');
  };

  document.getElementById('corr-help-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('corr-desc').classList.toggle('show');
  };

  document.getElementById('onthisday-close').onclick = () => {
    document.getElementById('onthisday-banner').style.display = 'none';
  };
}
