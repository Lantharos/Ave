// Shared state for the demo app
// Using Svelte 5 runes with module-level state

let _user = $state(null);
let _activeDemo = $state(null);
let _signResult = $state(null);

export const store = {
  get user() { return _user; },
  set user(value) { _user = value; },
  
  get activeDemo() { return _activeDemo; },
  set activeDemo(value) { _activeDemo = value; },
  
  get signResult() { return _signResult; },
  set signResult(value) { _signResult = value; },
  
  logout() {
    _user = null;
  },
  
  clearDemo() {
    _activeDemo = null;
  }
};
