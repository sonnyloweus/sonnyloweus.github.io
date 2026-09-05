import { S } from './state.js';
import { renderShopRadar } from './radar.js';
import { haversineMiles } from './stats.js';
import { hidePanel, getShopPhotos } from './panel.js';
import { trackEvent } from './analytics.js';
import {
  GOOGLE_STREETVIEW_API_KEY, STREETVIEW_RADIUS_TIERS_METERS,
  GAME_MAX_GUESSES, GAME_MAX_CLUES, GAME_CLUE_LABELS, GAME_CLUE_TAB_LABELS
} from './constants.js';

// =====================================================================
// Coffee-guessr
// A round picks one random spot from GLOBAL_DATA as the target. It opens
// on a (clear, pannable) Street View panorama of the spot — no other
// clues yet. The coffee radar and the other 3 clues (price+dates, tags,
// description) are all hidden until the player taps "Reveal next clue";
// guessing wrong does NOT auto-reveal anything. Clicking a pin just opens
// its stripped-down detail panel (name + photo both blurred) to preview
// it; the "Submit guess" button at the bottom of that panel is the actual
// guess action. Clues are browsed one at a time in a small slideshow to
// keep the HUD compact.
// =====================================================================

// ---- Street View setup ----
// Paste a Google Maps EMBED API key in constants.js's
// GOOGLE_STREETVIEW_API_KEY (Google Cloud Console → APIs & Services →
// Credentials → enable "Maps Embed API") to turn on the Street View panel.
// Leave it blank and Coffee-guessr still works fine — the radar/price/tags/
// description clues and guessing are unaffected; the Street View panel
// just shows a short placeholder instead of a live panorama.
//
// To pick a randomized (rather than always-closest) panorama, the same
// key also needs the "Street View Static API" enabled — that's what backs
// the metadata lookup below. If that API isn't enabled (or the metadata
// fetch fails for any other reason, e.g. no network), the lookup quietly
// fails and we fall back to the old behavior: hand Google the shop's own
// coordinates and let it pick whatever panorama is closest, however far
// away that ends up being.

export function buildStreetViewEmbedUrl(loc, headingDeg){
  const params = new URLSearchParams({
    key: GOOGLE_STREETVIEW_API_KEY,
    location: `${loc.lat},${loc.lng}`,
    heading: String(headingDeg),
    pitch: '0',
    fov: '90',
  });
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

// Uniform-random point within `radiusMeters` of (lat, lng). Uses sqrt(u) on
// the radius draw so points are distributed evenly over the disc's area
// rather than clumping toward the center.
export function randomPointWithinRadius(lat, lng, radiusMeters){
  const metersPerDegLat = 111320;
  const radiusDegLat = radiusMeters / metersPerDegLat;
  const u = Math.random();
  const v = Math.random();
  const w = radiusDegLat * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const dLat = w * Math.sin(t);
  const dLng = (w * Math.cos(t)) / Math.cos(lat * Math.PI / 180);
  return { lat: lat + dLat, lng: lng + dLng };
}

// Asks the Street View Static API's metadata endpoint whether a panorama
// exists near (lat, lng) — optionally within `radiusMeters` of it. Returns
// the parsed JSON ({status, location, ...}) or null on any failure
// (network error, API not enabled, non-OK HTTP response, etc.) so callers
// can just treat null the same as "no panorama found here."
async function fetchStreetViewMetadata(lat, lng, radiusMeters){
  if(!GOOGLE_STREETVIEW_API_KEY) return null;
  const params = new URLSearchParams({
    key: GOOGLE_STREETVIEW_API_KEY,
    location: `${lat},${lng}`,
  });
  if(radiusMeters) params.set('radius', String(radiusMeters));
  try{
    const res = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`);
    if(!res.ok) return null;
    return await res.json();
  }catch(err){
    return null;
  }
}

// Works through STREETVIEW_RADIUS_TIERS_METERS from smallest to largest,
// trying one random candidate point per tier. Returns the {lat,lng} of an
// actual panorama Google found, or — if nothing turned up at any radius —
// falls back to an unrestricted lookup around the shop itself, and finally
// to the shop's raw coordinates if even that lookup couldn't be made.
export async function pickRandomizedStreetViewLocation(shop){
  for(const radius of STREETVIEW_RADIUS_TIERS_METERS){
    const candidate = randomPointWithinRadius(shop.lat, shop.lng, radius);
    const meta = await fetchStreetViewMetadata(candidate.lat, candidate.lng, radius);
    if(meta && meta.status === 'OK' && meta.location){
      return { lat: meta.location.lat, lng: meta.location.lng };
    }
  }
  // Backup: no randomized point within any tier had a panorama nearby —
  // default to whatever's closest to the spot itself, regardless of
  // distance, same as the old always-closest behavior.
  const fallbackMeta = await fetchStreetViewMetadata(shop.lat, shop.lng, null);
  if(fallbackMeta && fallbackMeta.status === 'OK' && fallbackMeta.location){
    return { lat: fallbackMeta.location.lat, lng: fallbackMeta.location.lng };
  }
  // Metadata lookups themselves aren't working (key/network/API issue) —
  // hand the embed API the shop's raw coordinates and let it do its own
  // closest-panorama search, exactly like before this change.
  return { lat: shop.lat, lng: shop.lng };
}

// Called once per round, right after a target is picked — builds (or
// re-placeholders) the Street View iframe. A random heading each round so
// the panorama isn't always facing the same way, and a randomized (rather
// than always-closest) panorama location — see pickRandomizedStreetViewLocation.
export async function renderGameStreetView(){
  const frame = document.getElementById('game-streetview-frame');
  const shield = document.getElementById('game-streetview-shield');
  if(!frame) return;
  if(!GOOGLE_STREETVIEW_API_KEY){
    frame.innerHTML = '<div class="game-streetview-placeholder">Add a Google Maps Embed API key to GOOGLE_STREETVIEW_API_KEY in index.html to turn on the Street View clue.</div>';
    if(shield) shield.style.display = 'none';
    return;
  }
  const token = ++S.gameStreetViewToken;
  const shop = S.gameTarget;
  const loc = await pickRandomizedStreetViewLocation(shop);
  // A newer round (or re-render) started while this lookup was in flight —
  // let that one own the frame instead of clobbering it with a stale result.
  if(token !== S.gameStreetViewToken) return;
  const heading = Math.floor(Math.random() * 360);
  const url = buildStreetViewEmbedUrl(loc, heading);
  // Deliberately NO allowfullscreen here. The iframe is cross-origin
  // (Google's document, not ours) — once it goes fullscreen the browser
  // renders it in the "top layer" where nothing from our page, however high
  // its z-index, can paint above it, and we have no DOM access inside it to
  // add our own shield there either. So instead of trying to cover the
  // banner post-fullscreen, we just disable the fullscreen control itself:
  // dropping this attribute makes the browser refuse fullscreen requests
  // from inside the iframe, so the native fullscreen button in the embed's
  // corner becomes a no-op and the shield above can never be bypassed.
  frame.innerHTML = `<iframe src="${url}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
  if(shield) shield.style.display = 'block';
}

export function formatGameTime(totalSeconds){
  const m = Math.floor(totalSeconds / 60), s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
export function updateGameTimer(){
  if(!window.gameActive || S.gameOver) return;
  S.gameElapsedSeconds = Math.floor((Date.now() - S.gameStartTime) / 1000);
  const el = document.getElementById('game-timer');
  if(el) el.textContent = formatGameTime(S.gameElapsedSeconds);
}

export function pickGameTarget(){
  const pool = S.GLOBAL_DATA.filter(s => s.ratings && Object.keys(s.ratings).length >= 3 && s.tags && s.tags.length && s.note && s.area);
  const source = pool.length ? pool : S.GLOBAL_DATA;
  return source[Math.floor(Math.random() * source.length)];
}

export function openGameIntro(){
  document.getElementById('game-intro-overlay').classList.add('show');
}
export function closeGameIntro(){
  document.getElementById('game-intro-overlay').classList.remove('show');
}

export function startGame(){
  closeGameIntro();
  hidePanel();
  document.getElementById('game-result-overlay').classList.remove('show');
  // A game round is exclusive with every other overlay/side-panel — close
  // whatever might already be open before dropping into game mode.
  document.getElementById('stats-card').classList.remove('show');
  document.getElementById('brand').classList.remove('open');
  ['filter-card','compare-card','settings-card'].forEach(id => document.getElementById(id).classList.remove('show'));
  ['toggle-filter','toggle-compare','toggle-settings'].forEach(id => document.getElementById(id).classList.remove('on'));

  S.gameTarget = pickGameTarget();
  S.gameGuesses = [];
  S.gameCluesRevealed = 0;
  S.gameSlideIndex = 0;
  S.gameOver = false;
  S.gameExitArmed = false;
  S.gameHudCollapsed = false;
  window.gameActive = true;

  trackEvent('game_start');

  S.gameStartTime = Date.now();
  S.gameElapsedSeconds = 0;
  clearInterval(S.gameTimerInterval);
  S.gameTimerInterval = setInterval(updateGameTimer, 1000);
  const timerEl = document.getElementById('game-timer');
  if(timerEl) timerEl.textContent = '0:00';

  renderGameStreetView();

  const exitBtn = document.getElementById('game-exit-btn');
  exitBtn.textContent = 'Exit Game';
  exitBtn.classList.remove('confirm');
  exitBtn.style.display = 'flex';

  document.body.classList.add('game-mode');
  const hudEl = document.getElementById('game-hud');
  hudEl.classList.add('show');
  hudEl.classList.remove('collapsed');
  renderGameHUD();
}

export function endGame(){
  clearTimeout(S.gameExitTimer);
  clearInterval(S.gameTimerInterval);
  window.gameActive = false;
  document.body.classList.remove('game-mode');
  document.getElementById('game-hud').classList.remove('show');
  document.getElementById('game-exit-btn').style.display = 'none';
  // Drop the iframe so a backgrounded panorama isn't still loaded/using
  // resources once the round is over.
  const frame = document.getElementById('game-streetview-frame');
  if(frame) frame.innerHTML = '';
  hidePanel();
}

// These two lines back the *copyable* share text — always padded out to
// the full guesses/clues slots, unused shown as ⬜, Wordle-style.
export function gameResultGuessLine(){
  return Array.from({length: GAME_MAX_GUESSES}, (_, i) => {
    const g = S.gameGuesses[i];
    return g ? (g.correct ? '🟩' : '🟥') : '⬜';
  }).join('');
}
export function gameResultClueLine(){
  return Array.from({length: GAME_MAX_CLUES}, (_, i) => i < S.gameCluesRevealed ? '🟫' : '⬜').join('');
}

// Builds the Wordle-style emoji summary. Doesn't name the spot, same as
// Wordle's share text not spelling out the word.
export function buildGameResultEmoji(){
  return `Caffinated Sonny Coffee-guessr\n· Time: ${formatGameTime(S.gameElapsedSeconds)}\n· Guesses ${gameResultGuessLine()}\n· Clues ${gameResultClueLine()}`;
}

// The *on-screen* squares use real little boxes instead — the ⬜🟥🟩 emoji
// glyphs render inconsistently (odd sizing/spacing) across systems and
// fonts at a readable size, where here we control the box exactly.
export function gameResultBoxesHtml(){
  const guessBoxes = Array.from({length: GAME_MAX_GUESSES}, (_, i) => {
    const g = S.gameGuesses[i];
    const cls = g ? (g.correct ? 'green' : 'red') : '';
    return `<div class="game-result-box ${cls}"></div>`;
  }).join('');
  const clueBoxes = Array.from({length: GAME_MAX_CLUES}, (_, i) => {
    return `<div class="game-result-box ${i < S.gameCluesRevealed ? 'used' : ''}"></div>`;
  }).join('');
  return `<div class="game-result-line"><span class="game-result-line-label">Guesses</span><div class="game-result-box-row">${guessBoxes}</div></div>` +
    `<div class="game-result-line"><span class="game-result-line-label">Hints Used</span><div class="game-result-box-row">${clueBoxes}</div></div>`;
}

// Same reveal-photo slideshow the pin panel uses — shown on both a win and
// a loss, since either way the round is over and the name/photo are no
// longer a spoiler. Kept as its own index/array (rather than reusing
// panelPhotos) so this doesn't stomp on whatever the pin panel is
// currently showing underneath the modal.
export function renderGameResultPhoto(){
  const photoImg = document.getElementById('game-result-photo');
  const dotsEl = document.getElementById('game-result-photo-dots');
  if(!S.gameResultPhotos.length){
    photoImg.src = '';
    dotsEl.innerHTML = '';
    return;
  }
  photoImg.src = S.gameResultPhotos[S.gameResultPhotoIndex].src;
  dotsEl.innerHTML = '';
  if(S.gameResultPhotos.length > 1){
    S.gameResultPhotos.forEach((p, i) => {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i === S.gameResultPhotoIndex ? ' active' : '');
      dot.onclick = (e) => { e.stopPropagation(); S.gameResultPhotoIndex = i; renderGameResultPhoto(); };
      dotsEl.appendChild(dot);
    });
  }
}

function setupGameResultPhotoNav(){
  const wrap = document.getElementById('game-result-photo-wrap');
  let touchStartX = null;
  let suppressClick = false;

  wrap.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, {passive:true});
  wrap.addEventListener('touchend', e => {
    if(touchStartX === null || !S.gameResultPhotos.length){ touchStartX = null; return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if(Math.abs(dx) < 30) return; // treat as a tap, let the click handler below decide left/right
    suppressClick = true;
    S.gameResultPhotoIndex = dx < 0
      ? (S.gameResultPhotoIndex + 1) % S.gameResultPhotos.length
      : (S.gameResultPhotoIndex - 1 + S.gameResultPhotos.length) % S.gameResultPhotos.length;
    renderGameResultPhoto();
  }, {passive:true});

  wrap.addEventListener('click', e => {
    if(suppressClick){ suppressClick = false; return; }
    if(S.gameResultPhotos.length <= 1) return;
    const rect = wrap.getBoundingClientRect();
    const clickedLeftHalf = (e.clientX - rect.left) < rect.width / 2;
    S.gameResultPhotoIndex = clickedLeftHalf
      ? (S.gameResultPhotoIndex - 1 + S.gameResultPhotos.length) % S.gameResultPhotos.length
      : (S.gameResultPhotoIndex + 1) % S.gameResultPhotos.length;
    renderGameResultPhoto();
  });
}

export function showGameResultModal(){
  const won = S.gameGuesses.some(g => g.correct);
  document.getElementById('game-result-subtitle').textContent = won
    ? `Solved in ${S.gameGuesses.length} guess${S.gameGuesses.length === 1 ? '' : 'es'} · ${formatGameTime(S.gameElapsedSeconds)} 🎉`
    : `Out of guesses · ${formatGameTime(S.gameElapsedSeconds)}`;
  document.getElementById('game-result-answer').textContent = `It was ${S.gameTarget.name}.`;
  document.getElementById('game-result-squares').innerHTML = gameResultBoxesHtml();
  const copyBtn = document.getElementById('game-result-copy-btn');
  copyBtn.textContent = 'Copy results';
  copyBtn.classList.remove('game-result-copied');

  S.gameResultPhotos = getShopPhotos(S.gameTarget);
  S.gameResultPhotoIndex = 0;
  renderGameResultPhoto();
  const resultOverlay = document.getElementById('game-result-overlay');
  document.getElementById('game-result-photo-wrap').style.display = S.gameResultPhotos.length ? 'block' : 'none';
  resultOverlay.classList.toggle('has-photo', S.gameResultPhotos.length > 0);
  resultOverlay.classList.add('show');
}

// A correct guess (or the last guess used up) ends the round immediately —
// back to the normal map/toolbar, with a Wordle-style share summary.
export function finishGame(){
  showGameResultModal();
  endGame();
}

// Fixed-to-viewport toast (see .game-toast) — the one piece of guess
// feedback that's guaranteed visible no matter what else is on screen:
// pin panel open or closed, game HUD expanded or collapsed. Fades in,
// holds, and fades back out on its own; a second call just restarts the
// clock rather than stacking toasts.
export function showGameToast(message, variant){
  const el = document.getElementById('game-toast');
  if(!el) return;
  el.textContent = message;
  el.className = 'game-toast show' + (variant ? ' ' + variant : '');
  clearTimeout(S.gameToastTimer);
  S.gameToastTimer = setTimeout(() => { el.classList.remove('show'); }, 2200);
}

// Clicking a pin just previews it (the normal showPanel flow, stripped
// down to photo/name/location by the body.game-mode CSS rules) — this is
// the actual guess action, wired to the "Submit guess" button that lives
// at the bottom of that stripped panel.
export function handleGameGuessSubmit(shop){
  if(!window.gameActive || S.gameOver || !shop) return;
  if(S.gameGuesses.length >= GAME_MAX_GUESSES) return;

  const correct = shop === S.gameTarget;
  S.gameGuesses.push({ shop, correct });
  if(correct || S.gameGuesses.length >= GAME_MAX_GUESSES){
    S.gameOver = true;
    // Freeze the exact elapsed time right now, rather than however stale
    // the last once-a-second tick happened to be.
    S.gameElapsedSeconds = Math.floor((Date.now() - S.gameStartTime) / 1000);
    trackEvent('game_end', {
      result: correct ? 'win' : 'loss',
      guesses: S.gameGuesses.length,
      clues_used: S.gameCluesRevealed,
      time_seconds: S.gameElapsedSeconds
    });
    finishGame();
    return;
  }

  // Wrong guess, round continues — the panel is about to auto-close, so
  // this is the only moment the player sees this shop's distance-off
  // called out directly. Flash the button red with that readout, toast it
  // too (so it still lands even if the panel/HUD are out of view), then
  // close the panel a beat later instead of instantly.
  const distanceText = formatGuessDistance(shop);
  const guessesLeft = GAME_MAX_GUESSES - S.gameGuesses.length;
  showGameToast(`✗ Wrong — ${distanceText} · ${guessesLeft} guess${guessesLeft === 1 ? '' : 'es'} left`, 'wrong');

  const btn = document.getElementById('game-submit-guess-btn');
  if(btn){
    btn.textContent = `✗ ${distanceText}`;
    btn.classList.add('wrong-flash');
    btn.disabled = true;
  }

  renderGameHUD();
  // Guard against the delayed close clobbering a *different* pin's panel —
  // if the player taps another pin during this 900ms window, lastShownShop
  // will have moved on and this close is skipped.
  setTimeout(() => { if(S.lastShownShop === shop) hidePanel(); }, 900);
}

// Keeps the panel's "Submit guess" button in sync with the current round
// state every time the panel opens (or the round ends) — disabled once
// there's no active round left to submit a guess into.
export function syncGameSubmitButton(){
  const btn = document.getElementById('game-submit-guess-btn');
  if(!btn) return;
  btn.classList.remove('wrong-flash');
  const canSubmit = window.gameActive && !S.gameOver && S.gameGuesses.length < GAME_MAX_GUESSES;

  // If the pin currently shown is one the player already guessed this
  // round, re-show that outcome instead of resetting to "Submit guess" —
  // otherwise reopening a spot you already got wrong looks like the miss
  // never happened. Also blocks spending a second guess re-confirming a
  // result you already know.
  const priorGuess = S.lastShownShop && S.gameGuesses.find(g => g.shop === S.lastShownShop);
  if(canSubmit && priorGuess){
    btn.disabled = true;
    if(priorGuess.correct){
      btn.textContent = '✓ Correct guess';
    }else{
      btn.textContent = `✗ ${formatGuessDistance(priorGuess.shop)}`;
      btn.classList.add('wrong-flash');
    }
    return;
  }

  btn.disabled = !canSubmit;
  btn.textContent = (window.gameActive && S.gameOver) ? 'Round over' : 'Submit guess';
}

// Tapping a clue tab does one of two things depending on which tab it is:
// an already-revealed tab (i < gameCluesRevealed) just switches the content
// area to show it; the single next tab in line (i === gameCluesRevealed)
// reveals it and opens it in the same tap. Tabs further out than that are
// inert — clicks on them are never wired up in renderGameHUD below.
export function selectClueTab(i){
  if(i < S.gameCluesRevealed){
    S.gameSlideIndex = i;
    renderGameHUD();
    return;
  }
  if(i === S.gameCluesRevealed && S.gameCluesRevealed < GAME_MAX_CLUES){
    S.gameCluesRevealed++;
    S.gameSlideIndex = i;
    renderGameHUD();
  }
}

export function gameClueHtml(index){
  // index is 1-based (1 = radar, 2 = price/dates, 3 = tags, 4 = description)
  if(!S.gameTarget) return '';
  if(index === 1){
    return renderShopRadar(S.gameTarget, {showLabels: false}) || '<p>Not enough data for a radar.</p>';
  }
  if(index === 2){
    const bits = [];
    if(S.gameTarget.price) bits.push(`<b>${S.gameTarget.price}</b>`);
    if(S.gameTarget.visited && S.gameTarget.visited.length){
      bits.push('Visited ' + S.gameTarget.visited.join(', '));
    }
    return bits.join(' &middot; ') || 'No price/visit data.';
  }
  if(index === 3){
    return (S.gameTarget.tags && S.gameTarget.tags.length) ? S.gameTarget.tags.join('  &middot;  ') : 'No tags.';
  }
  if(index === 4){
    return S.gameTarget.note || 'No description.';
  }
  return '';
}

// A wrong guess shows how far off it was instead of a bare ✗ — reuses the
// same haversineMiles() the compare card and journey line already use.
export function formatGuessDistance(shop){
  if(!S.gameTarget || shop.lat == null || shop.lng == null || S.gameTarget.lat == null || S.gameTarget.lng == null){
    return '✗';
  }
  const miles = haversineMiles(shop.lat, shop.lng, S.gameTarget.lat, S.gameTarget.lng);
  return miles < 0.1 ? 'Right next door' : `${miles.toFixed(miles < 10 ? 1 : 0)} mi away`;
}

export function renderGameHUD(){
  if(!S.gameTarget) return;

  // ---- trackers (small, side by side) ----
  document.getElementById('game-guess-tracker').innerHTML = Array.from({length: GAME_MAX_GUESSES}, (_, i) => {
    const g = S.gameGuesses[i];
    const cls = g ? (g.correct ? 'green' : 'red') : '';
    return `<div class="game-track-box ${cls}"></div>`;
  }).join('');
  document.getElementById('game-clue-tracker').innerHTML = Array.from({length: GAME_MAX_CLUES}, (_, i) => {
    return `<div class="game-track-box ${i < S.gameCluesRevealed ? 'used' : ''}"></div>`;
  }).join('');

  // ---- clue tabs ----
  // All 4 clues (including the radar) start locked — nothing to show until
  // the player reveals at least one. Only the tab at index gameCluesRevealed
  // (the next one in line) is tappable while locked; it's styled like a
  // button and labeled "Reveal" instead of just looking dead like the ones
  // further out.
  const clueContentEl = document.getElementById('game-clue-content');
  if(S.gameCluesRevealed === 0){
    clueContentEl.innerHTML = '<span class="game-clue-locked">Tap a tab below to reveal your first clue.</span>';
  }else{
    clueContentEl.innerHTML = gameClueHtml(S.gameSlideIndex + 1);
  }
  document.getElementById('game-clue-tabs').innerHTML = GAME_CLUE_TAB_LABELS.map((label, i) => {
    const open = i < S.gameCluesRevealed;
    const isNext = i === S.gameCluesRevealed && S.gameCluesRevealed < GAME_MAX_CLUES;
    const active = open && i === S.gameSlideIndex;
    const cls = active ? 'active' : (open ? 'open' : (isNext ? 'next' : ''));
    const sub = isNext ? '<span class="game-clue-tab-sub">Reveal</span>' : '';
    return `<button type="button" class="game-clue-tab ${cls}" data-i="${i}" ${(!open && !isNext) ? 'disabled' : ''}>${label}${sub}</button>`;
  }).join('');
  document.querySelectorAll('.game-clue-tab').forEach(tab => {
    tab.onclick = () => selectClueTab(parseInt(tab.dataset.i, 10));
  });

  // ---- guess history ----
  // A correct guess still shows a checkmark; a wrong one shows how far off
  // it was instead of a bare ✗.
  document.getElementById('game-guess-list').innerHTML = S.gameGuesses.map(g => `
    <div class="game-guess-row">
      <span class="game-guess-name">${g.shop.name}</span>
      <span class="game-guess-status ${g.correct ? 'correct' : 'wrong'}">${g.correct ? '✓' : formatGuessDistance(g.shop)}</span>
    </div>`).join('');
}

export function fallbackCopy(text, onDone){
  try{
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onDone();
  }catch(e){ /* clipboard unavailable — no-op */ }
}

// ---- Wires up every static (data-independent) DOM listener this module
// owns: the game toolbar toggle, intro/result overlays, the exit-game
// confirm button, the Street View fullscreen guard, and the result photo
// carousel. Called once from main.js. ----
export function wireGameListeners(){
  window.gameActive = false;

  setupGameResultPhotoNav();

  // Belt-and-suspenders: if a fullscreen request on the Street View iframe
  // ever somehow succeeds anyway (e.g. a browser quirk around the missing
  // allowfullscreen attribute), immediately kick it back out of fullscreen
  // rather than let the unblurred banner sit exposed.
  document.addEventListener('fullscreenchange', () => {
    const fs = document.fullscreenElement;
    if(fs && fs.id === 'game-streetview-frame'){
      document.exitFullscreen().catch(() => {});
    }
    const frame = document.getElementById('game-streetview-frame');
    if(frame && fs && frame.contains(fs)){
      document.exitFullscreen().catch(() => {});
    }
  });

  document.getElementById('toggle-game').onclick = openGameIntro;
  document.getElementById('game-intro-overlay').onclick = (e) => { if(e.target.id === 'game-intro-overlay') closeGameIntro(); };
  document.getElementById('game-start-btn').onclick = startGame;
  document.getElementById('game-submit-guess-btn').onclick = () => handleGameGuessSubmit(S.lastShownShop);
  document.getElementById('game-hud-toggle').onclick = () => {
    S.gameHudCollapsed = !S.gameHudCollapsed;
    document.getElementById('game-hud').classList.toggle('collapsed', S.gameHudCollapsed);
  };

  document.getElementById('game-result-overlay').onclick = (e) => { if(e.target.id === 'game-result-overlay') document.getElementById('game-result-overlay').classList.remove('show'); };
  document.getElementById('game-result-close-btn').onclick = () => document.getElementById('game-result-overlay').classList.remove('show');
  document.getElementById('game-result-playagain-btn').onclick = startGame;
  document.getElementById('game-result-copy-btn').onclick = () => {
    const text = buildGameResultEmoji();
    const btn = document.getElementById('game-result-copy-btn');
    const showCopied = () => {
      btn.textContent = 'Copied!';
      btn.classList.add('game-result-copied');
      setTimeout(() => { btn.textContent = 'Copy results'; btn.classList.remove('game-result-copied'); }, 1800);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(showCopied).catch(() => fallbackCopy(text, showCopied));
    }else{
      fallbackCopy(text, showCopied);
    }
  };
  document.getElementById('game-exit-btn').onclick = () => {
    const btn = document.getElementById('game-exit-btn');
    if(!S.gameExitArmed){
      S.gameExitArmed = true;
      btn.textContent = 'Confirm';
      btn.classList.add('confirm');
      clearTimeout(S.gameExitTimer);
      S.gameExitTimer = setTimeout(() => {
        S.gameExitArmed = false;
        btn.textContent = 'Exit Game';
        btn.classList.remove('confirm');
      }, 3000);
    }else{
      clearTimeout(S.gameExitTimer);
      endGame();
    }
  };
}
