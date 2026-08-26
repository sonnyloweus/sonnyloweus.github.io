// Single shared mutable state object for every genuinely cross-feature
// variable. The original app was one giant inline <script> where all of
// this lived as ordinary top-level (or closed-over) `let`/`const`
// bindings shared by simple closure; now that the code is split across ES
// modules, a plain mutable object is the simplest way to keep that same
// "everyone sees the same live value" behavior — ES module bindings
// imported with `import {x}` are read-only in the importing module, so a
// value that gets reassigned (not just mutated) from more than one file
// has to live as a property on a shared object instead of as a bare
// exported `let`.
//
// Every module that reads or writes one of these touches it as `S.name`.
export const S = {
  // ---------- data.js ----------
  GLOBAL_DATA: [], // populated once initApp() loads the real data
  GLOBAL_AVG_RATING: 0,
  ratingBoundsMin: 0,
  ratingBoundsMax: 5,
  NORMALIZE_RATINGS: false,
  activePalette: 'roast',
  storedSettings: {},

  // ---------- panel.js ----------
  lastShownShop: null, // whichever shop the detail panel is currently showing, so rating-display toggles can refresh it in place
  // Wired up once initApp() below builds the markers — lets the modal-close
  // handler replay the map's pop-in animation, since a first-time visitor's
  // markers already finished popping in behind the modal before they could see it.
  replayMarkerPopIn: null,
  isFirstRunIntro: false,
  panelPhotos: [],
  panelPhotoIndex: 0,
  // Placeholder until initApp() wires up the real panel scrollbar (see
  // filters.js's setupCustomScrollbar) — showPanel() calls this every time
  // it opens, so it needs to exist as a no-op before that.
  updatePanelScrollbar: () => {},
  // Same idea for the settings and compare card scrollbars — read from
  // main.js/compare.js respectively, both wired up by filters.js's
  // setupFilters().
  updateSettingsScrollbar: () => {},
  updateCompareScrollbar: () => {},

  // ---------- modal.js ----------
  introIndex: 0,

  // ---------- map.js ----------
  map: null,
  clusterGroup: null,
  plainGroup: null, // used when clustering is toggled off
  clusteringOn: true,
  heatLayer: null,
  hotspotOn: true,
  activeSet: new Set(),
  shopMarkers: [],
  isMobileViewport: false,
  BUBBLE_HIT_PAD: {x: 0, y: 0},
  MAX_LIFETIME_VISITS: 1,
  dataBounds: null, // LatLngBounds of every shop, regardless of filters — backs refreshMinZoom()

  // ---------- filters.js ----------
  filters: { ratingLow: 0, ratingHigh: 5, prices: new Set(), tags: new Set(), search: '' },
  trailOn: true,
  trailLine: null,
  currentVisible: [],
  minDay: 0,
  maxDay: 0,
  lowDay: 0,
  highDay: 0,
  visitDays: [],
  allVisitDays: [],
  scrubberShouldShow: false,
  scrubberEl: null,
  sliderEl: null,
  fillEl: null,
  handleLow: null,
  handleHigh: null,
  ratingSliderEl: null,
  ratingFillEl: null,
  ratingHandleLow: null,
  ratingHandleHigh: null,

  // ---------- compare.js ----------
  compareShopA: null,
  compareShopB: null,

  // ---------- journey.js ----------
  journeyOn: false,
  journeyStops: [],
  journeyLines: [],
  journeyAnimFrame: null,
  journeyPauseTimer: null,

  // ---------- game.js ----------
  gameTarget: null,
  gameGuesses: [], // [{shop, correct}]
  gameCluesRevealed: 0,
  gameSlideIndex: 0, // which revealed clue (0-based) is open in the clue-tab content area
  gameOver: false,
  gameExitArmed: false,
  gameExitTimer: null,
  gameHudCollapsed: false,
  gameStartTime: null,
  gameElapsedSeconds: 0,
  gameTimerInterval: null,
  gameStreetViewToken: 0, // bumped on every renderGameStreetView() call so a slow/stale lookup can't land after a newer one has taken over
  gameResultPhotos: [],
  gameResultPhotoIndex: 0,
  gameToastTimer: null,
};
