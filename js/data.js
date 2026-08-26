import { S } from './state.js';
import { RATING_PALETTES, SETTINGS_KEY } from './constants.js';

// Fallback sample data used only if coffee.json can't be fetched
// (e.g. previewing this file directly instead of via a local/deployed server).
export const FALLBACK_DATA = [
  {name:"Devoción", area:"Williamsburg", country:"USA", type:"coffee", lat:40.7145, lng:-73.9575, overall:4.6,
   ratings:{richness:4.5, craft:4.7, ambiance:4.2, character:4.0, value:3.5},
   price:"$$", visited:["Aug 9, 2022","Jan 5, 2026","Mar 12, 2026"],
   note:"Single-origin pourover, roasted on-site.", tags:["pourover","quiet","laptop-friendly"],
   story:"This was my regular spot while building this very site.",
   photos:[
     {src:"https://picsum.photos/seed/devocion/500/350", date:"Aug 9, 2022"},
     {src:"https://picsum.photos/seed/devocion2/500/350", date:"Jan 5, 2026"},
     {src:"https://picsum.photos/seed/devocion3/500/350", date:"Mar 12, 2026"}
   ]},
  {name:"Sey Coffee", area:"Bushwick", country:"USA", type:"coffee", lat:40.7057, lng:-73.9339, overall:4.8,
   ratings:{richness:4.8, craft:4.9, ambiance:3.0, character:4.3, value:4.5},
   price:"$", visited:["Feb 2, 2026"],
   note:"Best filter coffee in the city, full stop.", tags:["filter"],
   photo:"https://picsum.photos/seed/sey/500/350"},
  {name:"Cafe Kitsuné", area:"SoHo", country:"USA", type:"coffee", lat:40.7233, lng:-74.0020, overall:3.9,
   ratings:{richness:3.0, craft:3.3, ambiance:4.8, character:4.2, value:2.5},
   price:"$$$", visited:["Apr 20, 2026"],
   note:"Beautiful space, come for the matcha.", tags:["aesthetic","laptop-friendly"],
   photo:"https://picsum.photos/seed/kitsune/500/350"},
  {name:"Partners Coffee", area:"Boerum Hill", country:"USA", type:"coffee", lat:40.6838, lng:-73.9836, overall:4.4,
   ratings:{richness:4.2, craft:4.3, ambiance:4.0, character:3.7, value:4.0},
   price:"$$", visited:["May 3, 2026"],
   note:"Great espresso, cozy window seats.", tags:["espresso","laptop-friendly"],
   photo:"https://picsum.photos/seed/partners/500/350"},
  {name:"Abraço", area:"East Village", country:"USA", type:"coffee", lat:40.7282, lng:-73.9857, overall:4.9,
   ratings:{richness:4.9, craft:5.0, ambiance:3.2, character:4.8, value:4.0},
   price:"$$", visited:["Jun 14, 2026","Jul 1, 2026"],
   note:"Tiny counter, unreal espresso.", tags:["espresso","standing-room"],
   photo:"https://picsum.photos/seed/abraco/500/350"},
  {name:"Culture Espresso", area:"Midtown", country:"USA", type:"coffee", lat:40.7486, lng:-73.9857, overall:4.1,
   ratings:{richness:3.8, craft:3.9, ambiance:3.5, character:3.3, value:3.5},
   price:"$$", visited:["Jul 22, 2026"],
   note:"Good for the neighborhood, great croissants.", tags:["pastries"],
   photo:"https://picsum.photos/seed/culture/500/350"},
  {name:"Ludlow Coffee Supply", area:"Lower East Side", country:"USA", type:"coffee", lat:40.7186, lng:-73.9879, overall:3.6,
   ratings:{richness:3.3, craft:3.4, ambiance:3.8, character:3.2, value:3.5},
   price:"$$", visited:["Feb 18, 2026"],
   note:"Solid drip, good people-watching from the window.", tags:["cozy"],
   photo:"https://picsum.photos/seed/ludlow/500/350"},
  {name:"Birch Coffee", area:"Flatiron", country:"USA", type:"coffee", lat:40.7410, lng:-73.9897, overall:4.0,
   ratings:{richness:3.6, craft:3.8, ambiance:3.5, character:3.0, value:3.5},
   price:"$$", visited:["Mar 3, 2026","May 22, 2026"],
   note:"Dependable, good wifi, gets crowded at lunch.", tags:["wifi","laptop-friendly"],
   photo:"https://picsum.photos/seed/birch/500/350"},
  {name:"Little Canal", area:"Chinatown", country:"USA", type:"coffee", lat:40.7158, lng:-73.9970, overall:3.3,
   ratings:{richness:3.0, craft:3.0, ambiance:2.8, character:3.8, value:3.5},
   price:"$", visited:["Jun 8, 2026"],
   note:"Tiny, easy to miss, decent black coffee.", tags:["hidden-gem"],
   story:"Found this by accident while lost looking for dim sum. Worth the detour.",
   photo:"https://picsum.photos/seed/littlecanal/500/350"},
  {name:"Variety Coffee Roasters", area:"Greenpoint", country:"USA", type:"coffee", lat:40.7305, lng:-73.9527, overall:4.7,
   ratings:{richness:4.5, craft:4.6, ambiance:4.0, character:4.2, value:4.2},
   price:"$$", visited:["Feb 27, 2026","Apr 9, 2026","Jul 15, 2026"],
   note:"Consistently excellent, my most-visited spot for a reason.", tags:["espresso","quiet"],
   photo:"https://picsum.photos/seed/variety/500/350"},
  {name:"Onibus Coffee", area:"Nakameguro, Tokyo", country:"Japan", type:"coffee", lat:35.6446, lng:139.6989, overall:4.7,
   ratings:{richness:4.3, craft:4.5, ambiance:4.9, character:4.6, value:3.8},
   price:"$$", visited:["Sep 4, 2025"],
   note:"Beautiful old house converted into a cafe, upstairs seating is worth it.", tags:["aesthetic","quiet"],
   photo:"https://picsum.photos/seed/onibus/500/350"},
  {name:"Kaffeine", area:"Fitzrovia, London", country:"UK", type:"coffee", lat:51.5178, lng:-0.1414, overall:4.3,
   ratings:{richness:4.0, craft:4.3, ambiance:3.7, character:3.8, value:3.3},
   price:"$$", visited:["Nov 11, 2025"],
   note:"Australian-style flat white done right, always busy.", tags:["espresso","laptop-friendly"],
   photo:"https://picsum.photos/seed/kaffeine/500/350"},
  {name:"Café de Flore", area:"Saint-Germain, Paris", country:"France", type:"coffee", lat:48.8540, lng:2.3325, overall:3.8,
   ratings:{richness:2.5, craft:2.8, ambiance:4.8, character:4.5, value:1.8},
   price:"$$$", visited:["Oct 2, 2025"],
   note:"You're paying for the history and the people-watching, not the coffee.", tags:["aesthetic","historic"],
   story:"Sat here for three hours pretending to write the great American novel.",
   photo:"https://picsum.photos/seed/flore/500/350"},
];

export async function loadData(){
  try{
    const res = await fetch('coffee.json');
    if(!res.ok) throw new Error('missing');
    return await res.json();
  }catch(e){
    return FALLBACK_DATA;
  }
}

export function tierClass(rating){
  if(rating >= 4.5) return 't7';
  if(rating >= 4.2) return 't6';
  if(rating >= 3.9) return 't5';
  if(rating >= 3.6) return 't4';
  if(rating >= 3.3) return 't3';
  if(rating >= 3.0) return 't2';
  return 't1';
}

export function applyPalette(key){
  const palette = RATING_PALETTES[key] || RATING_PALETTES.roast;
  palette.colors.forEach((c, i) => {
    document.documentElement.style.setProperty(`--tier-${i+1}`, c);
  });
}

// ---------- normalized rating display ----------
// Off by default. When on, every displayed rating is rescaled so the
// lowest-rated shop in the full dataset reads as 0 and the highest reads
// as 5 — a linear (affine) transform, so it never changes relative
// ordering, just stretches the visible range for better differentiation.
export function computeRatingBounds(){
  if(!S.GLOBAL_DATA || !S.GLOBAL_DATA.length){ S.ratingBoundsMin = 0; S.ratingBoundsMax = 5; return; }
  const vals = S.GLOBAL_DATA.map(s => s.overall);
  S.ratingBoundsMin = Math.min(...vals);
  S.ratingBoundsMax = Math.max(...vals);
}

export function displayRating(raw){
  if(!S.NORMALIZE_RATINGS) return raw;
  if(S.ratingBoundsMax === S.ratingBoundsMin) return 5;
  return ((raw - S.ratingBoundsMin) / (S.ratingBoundsMax - S.ratingBoundsMin)) * 5;
}

// ---------- settings persistence ----------
// Everything in the settings panel (clustering, trail, rating palette,
// normalize toggle) is saved to localStorage as one JSON blob and re-applied
// on the next visit. Wrapped in try/catch like the intro-modal flag above,
// since localStorage can throw in private-browsing/sandboxed contexts —
// storage failures just mean settings don't persist, not a broken page.
export function loadStoredSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
export function saveStoredSetting(key, value){
  try{
    const current = loadStoredSettings();
    current[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  }catch(e){ /* storage unavailable, no-op */ }
}

// Palette and the normalize flag don't depend on the map or the loaded
// shop data, so they're restored immediately rather than waiting on
// initApp() — clustering/trail default to on and are restored inside
// initApp() instead, once the map layers they control actually exist.
// Called once from main.js, before any other module's setup runs (mirrors
// the original inline script running this at the very top, before the
// panel/modal/init() code below it).
export function initSettings(){
  S.storedSettings = loadStoredSettings();
  S.activePalette = RATING_PALETTES[S.storedSettings.palette] ? S.storedSettings.palette : 'roast';
  applyPalette(S.activePalette);
  S.NORMALIZE_RATINGS = !!S.storedSettings.normalize;
}

export function earliestVisit(shop){
  if(!shop.visited || !shop.visited.length) return null;
  return Math.min(...shop.visited.map(d => new Date(d).getTime()));
}
export function formatDay(dayNum){
  return new Date(dayNum * 86400000).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
}
