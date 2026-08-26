/* global lucide */
// Entry point — replaces the original single inline <script> block. Each
// module attaches its own listeners / renders its own pieces through an
// exported setup function; this file just calls them in the same relative
// order the original top-to-bottom script ran in.
import { initSettings } from './data.js';
import { setupPanelPhotoNav, wirePanelListeners } from './panel.js';
import { wireModalListeners, maybeShowIntroOnLoad } from './modal.js';
import { wireGameListeners } from './game.js';
import { initApp } from './map.js';

// Renders every <i data-lucide="..."> placeholder (toolbar icons, the stats
// dropdown's icon, the help button) into inline SVG. All of this page's
// icon markup is static and already in the DOM by the time this script
// tag runs, so one call up front is enough — nothing here is added later.
if(window.lucide) lucide.createIcons();

// Palette and the normalize flag don't depend on the map or the loaded
// shop data, so they're restored immediately, before anything else here
// runs — mirrors the original inline script doing this at the very top.
initSettings();

setupPanelPhotoNav();
wirePanelListeners();

wireModalListeners();
// intro modal — shows automatically once, then only via the "?" button.
maybeShowIntroOnLoad();

wireGameListeners();

// The big async bootstrap: loads coffee.json (or falls back to sample
// data), builds the Leaflet map, filters, compare card, journey, and
// markers, then reveals them. Not awaited by anything after it (there's
// nothing after it) — matches the original inline `(async function
// init(){...})()` firing off and letting the rest of the script (the
// Coffee-guessr section, wired above) continue running independently
// while it loads.
initApp();
