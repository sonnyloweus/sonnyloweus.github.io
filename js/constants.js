// Shared constants used by 3+ modules (or just grouped here for clarity).
// Pure data — no DOM access, no state mutation.

// ---------- rating color palettes ----------
// Two 7-step gradients (lowest tier -> highest) that can be swapped onto
// the --tier-1..7 CSS custom properties driving bubble colors. "Roast" is
// the original palette and stays the default.
export const RATING_PALETTES = {
  roast:    { label:'Roast',     colors:['#C5AD9B','#B6957C','#A67D5E','#8F694D','#72533C','#543D2B','#4A2A16'], accent:'#4A2A16' },
  coldbrew: { label:'Cold Brew', colors:['#C9DCE3','#A8C5D1','#7CA8B9','#57879C','#3C6780','#2A4A61','#1B2F40'], accent:'#1B2F40' },
  // "Noir" — a fully desaturated, cool-toned grayscale theme. Unlike the
  // other two (which only swap the --tier-N bubble gradient + --accent),
  // this one also overrides the neutral site-wide vars below (--bg, --ink,
  // --dim, --crema*, --coffee-*, --ceramic*, --compare-*) so picking it
  // turns the *entire* page monotone — buttons, title bar/brand pill,
  // toggles, the coffee-cup radar — not just the rating bubbles. See
  // applyPalette() in data.js, which reads these optional overrides and
  // falls back to the default --root values below when a palette omits them.
  // The gradient runs steep on purpose: the top tier sits just short of
  // true black (#0C0D0E) so the highest-rated shops read as unmistakably
  // "blackest of the black" against the lighter tiers below them.
  mono:     { label:'Noir',      colors:['#DEE2E4','#C0C5C8','#9FA5A8','#7D8386','#585D60','#34383A','#0C0D0E'], accent:'#0C0D0E',
              bg:'#F5F6F7', ink:'#15171A', dim:'#868C90',
              crema:'#D7DADC', cremaLight:'#E6E8E9', cremaLightest:'#F1F2F3',
              coffeeMid:'#4A4E52', coffeeDark:'#24272A',
              ceramic:'#F3F4F5', ceramicEdge:'#D3D6D8',
              compareA:'#FFFFFF', compareB:'#7B8288' }
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
export const POP_IN_BASE_WAIT = 0.45; // pause after page load before the first pop, so the map/tiles settle first

// ---- journey zoom bounds ----
// Stops are tight-to-tight now (see journey.js's animateLeg) — every leg's
// flyTo targets this same zoom at both ends, rather than zooming out to
// frame the two points together. Leaflet's own flyTo still eases the zoom
// down and back up for a long hop on its own (that's the whole point of
// flyTo over setView), so the "zoom out, travel, zoom back in" motion
// still happens — it's just driven by distance, not a deliberate
// fit-both-points target.
export const JOURNEY_MAX_ZOOM = 15;

// ---- journey.json stop types ----
// One label + one accent per type, shared between the story modal
// (journey.js) and kept in sync by hand with add-journey.html's own copy
// of this mapping (that editor runs standalone, with no import access to
// this module). The colors are the site's own --tier-N tokens rather than
// a separate palette, so a stop's accent still follows whichever rating
// theme (Roast/Cold Brew/Noir) is active, and stays legible against it.
export const JOURNEY_TYPE_LABELS = {
  education: 'Education', project: 'Project', research: 'Research',
  paper: 'Paper', internship: 'Internship'
};
export const JOURNEY_TYPE_COLOR_VARS = {
  education: 'var(--tier-2)', project: 'var(--tier-4)', research: 'var(--tier-5)',
  paper: 'var(--tier-6)', internship: 'var(--tier-7)'
};

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

// ---- Topo contour heatmap (alternate style for the hotspot layer) ----
// Low-to-high density stops for the d3.contourDensity() render in map.js's
// TopoHeatLayer. Ordered like a thermal/weather-radar ramp (cool -> hot)
// rather than the rating palettes above, since this is about visit
// density, not review scores, and stays fixed across all three rating
// themes for that reason.
export const TOPO_COLOR_STOPS = ['#241b52', '#1d4ed8', '#0891b2', '#16a34a', '#eab308', '#f97316', '#dc2626'];
// Number of density bands d3.contourDensity() slices the field into —
// more bands = finer rings (closer to the reference topo-map look), fewer
// = chunkier and cheaper to redraw on every pan/zoom.
export const TOPO_THRESHOLDS = 14;
// KDE bandwidth in screen pixels at the map's *current* zoom, scaled by
// zoomFactor in map.js (tighter clusters need a smaller radius to resolve
// into separate peaks instead of one mega-blob). These are the floor/
// ceiling that scaling is clamped to — i.e. the hotspot radius. Trimmed
// down from the original 22/90 for a slightly tighter, less sprawling
// effect.
export const TOPO_BANDWIDTH_MIN = 15;
export const TOPO_BANDWIDTH_MAX = 64;
// TOPO_FILL_ALPHA is the *one* opacity knob for the whole topo layer —
// TopoHeatLayer._redraw (map.js) paints every band fully opaque onto an
// offscreen buffer first (so the rainbow stays crisp, band cleanly over
// band, instead of ~14 translucent fills stacking into gray mush) and
// only fades that finished buffer down by this amount in a single pass.
// Low on purpose — this sits *under* the pins and basemap labels, so it
// should read as a tint, not a solid layer of color.
export const TOPO_FILL_ALPHA = 0.3;
// The outermost band (TOPO_COLOR_STOPS[0], the lowest-density "floor"
// ring) is painted into that same offscreen buffer at *this* reduced
// alpha instead of fully opaque like every other band — see the i===0
// case in TopoHeatLayer._redraw. It still gets multiplied by
// TOPO_FILL_ALPHA on top like everything else, so its final on-page
// opacity is TOPO_OUTERMOST_ALPHA * TOPO_FILL_ALPHA — noticeably fainter
// than the rest of the gradient, so the outer edge fades out instead of
// ending in a visible ring.
export const TOPO_OUTERMOST_ALPHA = 0.25;
// d3.contourDensity()'s default thresholds are linearly spaced from ~0 to
// the single highest density value anywhere on the map. That's a problem
// the moment one shop is geographically isolated (say, the only coffee
// stop on a trip to China): its density peak can be an order of magnitude
// below a tight home-city cluster's peak, so under linear spacing it
// never crosses even the lowest band and renders with *no* color at all,
// not just a faint one. TopoHeatLayer._redraw (map.js) fixes this by
// carving out one deliberately low "floor" threshold — this fraction of
// the map's single highest density value — so even a lone faint point
// reliably clears it and shows up as a pale ring. The remaining bands
// stay evenly (linearly) spaced above that floor, same as d3's default,
// so dense clusters still get a smooth, evenly-graded rainbow rather than
// having all their resolution crammed toward one end.
export const TOPO_OUTLIER_FLOOR_FRACTION = 0.004;

// ---- Cloud heatmap (the "Cloud" style — leaflet.heat) ----
// Radius of each point's soft blob, in screen pixels — bumped up slightly
// from leaflet.heat's typical default for a fuller, more overlapping glow.
export const CLOUD_RADIUS = 50;
export const CLOUD_BLUR = 34;
// Caps how dark the glow's hottest spots can read. heatGradientForPalette
// (map.js) lightens the gradient's top stop — the color the densest
// pixels actually paint — by mixing it toward white by this fraction,
// instead of ever hitting the rating palette's darkest tier color at
// full strength.
export const CLOUD_MAX_DARKNESS_LIGHTEN = 0.35;

// ---- Voronoi territories (alternate map overlay, off by default) ----
// Each cell is tinted by its own shop's rating tier — the same --tier-1..7
// gradient the pins already use (read fresh off the DOM on every redraw, so
// it follows the active rating theme and the normalize toggle automatically)
// rather than a second, competing color system. The point is "which shop
// is this closest to, and how did you rate it," not a new palette to learn.
// Cells are tinted by their shop's rating tier — kept subtle so it reads
// as a faint wash rather than competing with the markers. Fill alpha
// isn't flat: it scales with how far the tier sits from the middle of
// the 1-7 scale, so an average-rated shop's cell is nearly invisible
// (ALPHA_MIN) while a standout-great or standout-bad one's cell reads
// darker (ALPHA_MAX) — most cells stay very transparent, but the
// extremes get enough contrast to actually notice. The border is a flat
// neutral-gray constant (not read from --dim, since a palette like
// "Noir" can repaint that var — this border should stay put regardless
// of theme) at higher contrast so cell boundaries stay legible against
// the light fill.
export const VORONOI_FILL_ALPHA_MIN = 0.012;
export const VORONOI_FILL_ALPHA_MAX = 0.10;
export const VORONOI_STROKE_ALPHA = 0.55;
export const VORONOI_STROKE_WIDTH = 0.6;
export const VORONOI_STROKE_COLOR = '#8C8579';

