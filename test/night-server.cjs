// Boots the real server with Date.now shifted so the shared day/night
// clock reads "2 minutes into night" at launch — lets a browser playthrough
// exercise night mobs, the torch ritual, and night visuals on demand.
// The chosen offset is printed so a client can apply the same shift.
// Run: node test/night-server.cjs   (PORT honored, defaults 3000)
const realNow = Date.now;
const DAY_MS = 20 * 60 * 1000;
const NIGHT_MS = 20 * 60 * 1000;
const CYCLE_MS = DAY_MS + NIGHT_MS;
// Land at DAY_MS + 2min into the cycle (fresh night, 18 min of it left).
const target = DAY_MS + 2 * 60 * 1000;
const cur = realNow() % CYCLE_MS;
const OFFSET = ((target - cur) + CYCLE_MS) % CYCLE_MS;
Date.now = () => realNow() + OFFSET;
console.log('NIGHT_CLOCK_OFFSET_MS=' + OFFSET);
require('../server.js');
