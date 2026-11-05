/**
 * Light landing enhancements: cycle the hero “live” signal so the product
 * stage feels active without depending on WebSocket state.
 */
const signals = [...document.querySelectorAll('.signal')];
if (signals.length && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let i = 0;
  setInterval(() => {
    signals.forEach((el, idx) => el.classList.toggle('is-live', idx === i));
    i = (i + 1) % signals.length;
  }, 2200);
}
