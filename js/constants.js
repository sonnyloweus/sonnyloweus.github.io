// Shared constants used by 3+ modules (or just grouped here for clarity).
// Pure data — no DOM access, no state mutation.

// ---------- rating color palettes ----------
// Three 7-step gradients (lowest tier -> highest) that can be swapped onto
// the --tier-1..7 CSS custom properties driving bubble colors. "Roast" is
// the original palette and stays the default.
export const RATING_PALETTES = {
  roast:    { label:'Roast',     colors:['#C5AD9B','#B6957C','#A67D5E','#8F694D','#72533C','#543D2B','#4A2A16'] },
  blossom:  { label:'Blossom',   colors:['#E7C6C0','#DDA79D','#CD8478','#B15E52','#8B3F36','#652A26','#421A18'] },
  coldbrew: { label:'Cold Brew', colors:['#C9DCE3','#A8C5D1','#7CA8B9','#57879C','#3C6780','#2A4A61','#1B2F40'] }
};

// ---------- settings persistence ----------
export const SETTINGS_KEY = 'coffeeMapSettings';

// intro modal — shows automatically once, then only via the "?" button.
export const INTRO_KEY = 'coffeeMapIntroSeen';

// Per-shop taste-profile "coffee cup" radar for the detail panel: the ratings
// trace a patch of foam on a cup of coffee viewed from directly above, with
// a half-pill handle, a gloss highlight, and a fused directional shadow.
export const CATEGORY_ORDER = ['richness','craft','ambiance','character','value'];

// Ratings cluster hard between 3.5 and 4.5 in practice, so a plain linear
// v/5 mapping makes every shop's radar look nearly identical. This piecewise
// map stretches that band out across most of the radius so shops actually
// differentiate visually: 1–3.5 compressed into 26% of the line, 3.5–4.0
// gets 30%, 4.0–4.7 gets another 30%, and 4.7–5.0 (the rarest, most
// meaningful spread) gets the remaining 14%. Used by both renderShopRadar
// and renderCompareRadar below — identical math, same breakpoints.
export const RADIUS_BREAKPOINTS = [[1,0.0], [3.5,0.26], [4.0,0.56], [4.7,0.86], [5,1.0]];

// rough estimates — not meant to be precise, just fun back-of-envelope numbers
export const PRICE_ESTIMATE = { '$': 3.5, '$$': 5.5, '$$$': 8 };
export const PRICE_RANK = { '$': 1, '$$': 2, '$$$': 3 };
export const MG_CAFFEINE_PER_CUP = 95;
export const EARTH_RADIUS_MILES = 3958.8;
export const EARTH_CIRCUMFERENCE_MILES = 2 * Math.PI * EARTH_RADIUS_MILES; // ~24,881 mi, equatorial
export const MG_CAFFEINE_PER_REDBULL = 80; // one 8.4oz can

// ---- Street View setup ----
// Paste a Google Maps EMBED API key below to turn on the Street View
// panel (Google Cloud Console → APIs & Services → Credentials → enable
// "Maps Embed API"). Leave this blank and Coffee-guessr still works fine
// — the radar/price/tags/description clues and guessing are unaffected;
// the Street View panel just shows a short placeholder instead of a live
// panorama.
//
// To pick a randomized (rather than always-closest) panorama, the same
// key also needs the "Street View Static API" enabled — that's what backs
// the metadata lookup below. If that API isn't enabled (or the metadata
// fetch fails for any other reason, e.g. no network), the lookup quietly
// fails and we fall back to the old behavior: hand Google the shop's own
// coordinates and let it pick whatever panorama is closest, however far
// away that ends up being.
export const GOOGLE_STREETVIEW_API_KEY = 'AIzaSyDJS5yx-eZQRro6DxcumF0XNhDfqDHoQnY';

// ---- CARTO basemap key ----
// CARTO now requires a (free) API key for their basemap tiles, or every
// tile renders with an "api key required" watermark instead of the actual
// map. Get one at https://carto.com/basemaps/apikey/ (instant, no CARTO
// account needed) and paste it below.
export const CARTO_API_KEY = 'cb1_29mn_1_140cf3700f30d94235d2b52d';

// Search tiers, in order: each tries a random point within `radius` meters
// of the coffee spot and asks Street View for the nearest panorama within
// that same radius of the random point. First tier that finds one wins.
// If every tier comes up empty, we fall back to an unrestricted lookup
// centered on the shop itself (closest available, regardless of distance).
export const STREETVIEW_RADIUS_TIERS_METERS = [60, 250];

export const GAME_MAX_GUESSES = 3;
export const GAME_MAX_CLUES = 4;
export const GAME_CLUE_LABELS = ['Coffee radar', 'Price & dates visited', 'Tags', 'Description'];
export const GAME_CLUE_TAB_LABELS = ['Radar', 'Price', 'Tags', 'Desc']; // short forms for the compact clue tabs

// ---- pop-in timing helper constants ----
export const POP_EASE = 1.6;
export const POP_IN_BASE_WAIT = 0.6; // pause after page load before the first pop, so the map/tiles settle first

// ---- journey zoom bounds ----
export const JOURNEY_MIN_ZOOM = 4;  // never zoom out further than this during a leg
export const JOURNEY_MAX_ZOOM = 15; // never zoom in closer than this, even for very short hops

// ---- dynamic minZoom ----
// A fixed minZoom (the map's old behavior) means "fully zoomed out" shows
// a fixed amount of *screen width*, not a fixed amount of *world* — on a
// narrow phone viewport that's a much smaller slice of the map than on a
// wide desktop window, so a portrait phone can get stuck unable to zoom
// out far enough to ever see more than a handful of pins at once. Instead
// minZoom is recomputed (see refreshMinZoom in map.js) from the zoom level
// that actually fits every shop in the current viewport, so "all the way
// out" always means "see everything," on any screen size or orientation.
// Floor of 0 (Leaflet's actual minimum), not some arbitrary "don't zoom out
// too far" cutoff — a real collection can genuinely need to zoom out past
// what feels like a sane floor. Case in point: a single far-outlier shop
// (e.g. one continent away from everywhere else you've been) can need a
// sub-1 zoom to fit alongside a tight cluster of everything else. An
// artificial floor above that legitimate fit zoom clamps the initial view
// tighter than the data needs — and because a tight cluster (like a home
// city) still has *some* pins survive that crop while a single isolated
// outlier has nothing nearby to save it, the outlier is exactly what
// silently disappears. Learned this the hard way from a shop in China
// going missing against a California-heavy dataset — 0 is the only floor
// that can't reproduce that.
export const MIN_ZOOM_FLOOR = 0;
export const MIN_ZOOM_CEILING = 3;    // never let it rise above the old fixed default either —
                                       // desktop keeps its usual bit of surrounding world context
export const MIN_ZOOM_BUFFER = 0.4;   // a little slack past the exact fit so pins aren't flush to the edge

// How many zoom levels a cluster click jumps in by. Bump this up if it
// still feels too shy, or down if it starts to feel like too much.
export const CLUSTER_ZOOM_STEP = 3;

// ---- Head to head compare ----
export const COMPARE_COLOR_A = 'var(--compare-a)';
export const COMPARE_COLOR_B = 'var(--compare-b)';
