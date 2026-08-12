// Global input lock. When locked, movement controls and handheld-item
// interactions (scroll switching, right-click / tap interact) are ignored.
// Used to freeze gameplay while UI overlays (main menu, About) are open.

let locked = false;

export function setInputLocked(value) {
  locked = !!value;
}

export function isInputLocked() {
  return locked;
}
