// Ashminster: the town in the middle of the Ember Wastes, and the minster that
// stood through the war that made them. This is the game's own invention; no
// historical place or event is claimed.
//
// The client draws the minster from its own copy of these numbers
// (EMBER_TOWN in client/ember-scene.js); test/ember-town.test.js keeps the
// two in step.
const EMBER_TOWN = {
  id: 'ashminster',
  name: 'Ashminster',
  x: 10000, y: 11000,
  radius: 1900,           // how near before the place is named to you
  clear: 1500,            // nothing spawns nearer the minster than this
  blurb: 'A minster that stood through the war that made the Wastes. The tower lost its head and the nave its roof, but the east window is still in its glass.',
  // the minster model (public/kk/home/minster.glb): one model unit is this many world units, and it is turned to show its broken side to the south
  unit: 250, height: 7.5, turn: Math.PI,
};

module.exports = { EMBER_TOWN };
