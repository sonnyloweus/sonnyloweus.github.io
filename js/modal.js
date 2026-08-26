import { S } from './state.js';
import { INTRO_KEY } from './constants.js';
import { startGame } from './game.js';

// Ambient auto-scrolling list of every spot's name, for the "So Far..."
// slide. The track renders the name list twice back-to-back and the
// keyframe (in CSS) translates by exactly one copy's height, so the loop
// seam is invisible; the mask on the container fades names in/out at the
// top and bottom edges. Speed scales gently with how many spots there are
// so it always reads as unhurried regardless of collection size.
export function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function buildNameMarquee(){
  if(!S.GLOBAL_DATA.length) return '';
  const names = S.GLOBAL_DATA.map(s => s.name).filter(Boolean);
  if(names.length < 2) return '';
  const itemsHtml = names.map(n => `<div class="modal-marquee-item">${escapeHtml(n)}</div>`).join('');
  const duration = Math.max(names.length * 2.4, 30);
  return `<div class="modal-marquee-track" style="animation-duration:${duration}s;">${itemsHtml}${itemsHtml}</div>`;
}

export const INTRO_SLIDES = [
  {
    icon: `<svg viewBox="0 0 48 48" fill="none" width="100%" height="100%">
      <path d="M11 18h21v9a10.5 10.5 0 01-10.5 10.5v0A10.5 10.5 0 0111 27.5V18z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M32 20.5h2.5a4.5 4.5 0 010 9H32" stroke="currentColor" stroke-width="2"/>
      <path d="M16 12c0-1.8 1.8-1.8 1.8-3.6S16 6.8 16 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M22 12c0-1.8 1.8-1.8 1.8-3.6S22 6.8 22 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    title: "Caffinated Sonny",
    text: "My ongoing coffee exploration from around the world."
  },
  {
    title: "So Far...",
    grid: () => {
      if(!S.GLOBAL_DATA.length) return null;
      const cups = S.GLOBAL_DATA.reduce((sum, s) => sum + ((s.visited && s.visited.length) || 1), 0);
      const spots = S.GLOBAL_DATA.length;
      const countries = new Set(S.GLOBAL_DATA.map(s => s.country).filter(Boolean)).size;
      const cities = new Set(S.GLOBAL_DATA.map(s => s.area).filter(Boolean)).size;
      return [
        {value: cups, label: 'cups'},
        {value: spots, label: 'places'},
        {value: countries, label: 'countries'},
        {value: cities, label: 'cities'}
      ];
    },
    marquee: () => buildNameMarquee(),
    text: ''
  },
  {
    title: "Cartography",
    text: "Click on spots to see a detailed breakdown, find easter egg stories, customize the map to your liking, and search across the coffee catalog."
  }
];

export function renderIntroSlide(){
  const s = INTRO_SLIDES[S.introIndex];
  const isLast = S.introIndex === INTRO_SLIDES.length - 1;
  const iconEl = document.getElementById('modal-icon');
  if(s.icon){
    iconEl.innerHTML = s.icon;
    iconEl.style.display = '';
  }else{
    iconEl.innerHTML = '';
    iconEl.style.display = 'none';
  }
  document.getElementById('modal-title').textContent = s.title;

  const gridEl = document.getElementById('modal-stats-list');
  const gridData = s.grid ? s.grid() : null;
  if(gridData){
    gridEl.innerHTML = gridData.map(d => `<div class="modal-stat-row"><span class="modal-stat-label">${d.label}</span><span class="modal-stat-value">${d.value}</span></div>`).join('');
    gridEl.style.display = 'block';
  }else{
    gridEl.innerHTML = '';
    gridEl.style.display = 'none';
  }

  const marqueeEl = document.getElementById('modal-marquee');
  const marqueeHtml = s.marquee ? s.marquee() : '';
  if(marqueeHtml){
    marqueeEl.innerHTML = marqueeHtml;
    marqueeEl.style.display = 'block';
  }else{
    marqueeEl.innerHTML = '';
    marqueeEl.style.display = 'none';
  }

  const textVal = typeof s.text === 'function' ? s.text() : s.text;
  const textEl = document.getElementById('modal-text');
  textEl.textContent = textVal;
  textEl.style.display = textVal ? '' : 'none';

  document.querySelectorAll('.modal-dot').forEach((d,i) => d.classList.toggle('active', i === S.introIndex));

  // The last slide swaps the single Next/Got it button for the Explore /
  // Follow Sonny's Journey pair; earlier slides keep the simple advance button.
  document.getElementById('modal-close').style.display = isLast ? 'none' : 'block';
  document.getElementById('modal-actions').style.display = isLast ? 'flex' : 'none';
  if(!isLast) document.getElementById('modal-close').textContent = 'Next';
}

export function openModal(){
  S.introIndex = 0;
  renderIntroSlide();
  document.getElementById('modal-overlay').classList.add('show');
}
export function closeModal(){
  document.getElementById('modal-overlay').classList.remove('show');
  try{ localStorage.setItem(INTRO_KEY, '1'); }catch(e){ /* storage unavailable, no-op */ }
  // First-time visitors had the map hidden behind this modal while the
  // markers did their initial pop-in, so give them the reveal now instead —
  // wait for the modal's own fade-out (0.2s) to finish first.
  if(S.isFirstRunIntro){
    S.isFirstRunIntro = false;
    setTimeout(() => { if(S.replayMarkerPopIn) S.replayMarkerPopIn(); }, 250);
  }
}

export function wireModalListeners(){
  document.querySelectorAll('.modal-dot').forEach(dot => {
    dot.onclick = () => { S.introIndex = parseInt(dot.dataset.i, 10); renderIntroSlide(); };
  });
  document.getElementById('modal-close').onclick = () => {
    if(S.introIndex < INTRO_SLIDES.length - 1){ S.introIndex++; renderIntroSlide(); }
    else { closeModal(); }
  };
  document.getElementById('modal-explore-btn').onclick = () => { closeModal(); };
  // startGame() lives in game.js — imported above.
  document.getElementById('modal-play-game-btn').onclick = () => { closeModal(); startGame(); };
  document.getElementById('modal-overlay').onclick = (e) => { if(e.target.id === 'modal-overlay') closeModal(); };
  document.getElementById('help-btn').onclick = openModal;
}

// Shows the intro modal automatically on a visitor's first load. Wrapped in
// try/catch since localStorage can be unavailable in some sandboxed/
// private-browsing contexts; falls back to always-show-once-per-load.
export function maybeShowIntroOnLoad(){
  let alreadySeenIntro = false;
  try{ alreadySeenIntro = !!localStorage.getItem(INTRO_KEY); }catch(e){ /* storage unavailable */ }
  if(!alreadySeenIntro){ S.isFirstRunIntro = true; openModal(); }
}
