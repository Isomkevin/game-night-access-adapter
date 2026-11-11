/* global gameNight */

gameNight.onCoachInfo(() => {
  /* hub/landing URLs available if needed later */
});

document.getElementById('btn-hub').addEventListener('click', () => {
  gameNight.openHub();
});

document.getElementById('btn-landing').addEventListener('click', () => {
  gameNight.openLanding();
});
