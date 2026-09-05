// Thin wrapper around GA4's gtag() (loaded via the <script> snippet in
// index.html's <head>). Every call site elsewhere in the app goes through
// this instead of calling window.gtag directly, so a blocked/missing GA4
// script (ad blockers, offline preview, a page without the snippet) is a
// silent no-op instead of a thrown error breaking the feature it's attached to.
export function trackEvent(name, params){
  try{
    if(typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }catch(e){}
}
