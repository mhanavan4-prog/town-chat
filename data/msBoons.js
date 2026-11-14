// Moonstone time-savers (server.js ms_boon): each spends 💎 to skip a wait that is already in the game. None
// sells experience, levels, gold or gear: what they sell is not waiting. The price is the whole dial.
const MS_BOONS = [
  { id: 'rested', icon: '😴', name: 'Rested again', cost: 10,
    blurb: 'Ten minutes of +50% experience, starting now, without waiting out the two hours between rests.' },
  { id: 'torches', icon: '🔥', name: 'Light the temple torches', cost: 15,
    blurb: 'The four torches burn for twenty minutes, whatever the hour, and the way to the Ember Wastes stands open to everyone in town.' },
  { id: 'besom', icon: '🧹', name: 'Whistle up the besom', cost: 3,
    blurb: 'Your besom carries you now, by day or while it is resting. You must have made one (the Old Ways).', choose: 'landing' },
  { id: 'harvest', icon: '🌿', name: 'Second harvest', cost: 4,
    blurb: 'Stand at a plant you have already picked today: it is ready to pick again.' },
  { id: 'round', icon: '🥾', name: 'The day\'s round again', cost: 12,
    blurb: 'One of the once-a-day rounds can be walked again today.', choose: 'round' },
];
const MS_BOONS_BY_ID = Object.fromEntries(MS_BOONS.map((b) => [b.id, b]));
// The rounds that can be walked again, and where each keeps its day on the account.
const ROUNDS = [
  { id: 'wayside', name: 'The road north (gibbet, coin tree, coffin stone)', key: 'wayside' },
  { id: 'drove', name: 'The drove road', key: 'droveRoad' },
  { id: 'byways', name: 'The by-ways', key: 'byways' },
  { id: 'lore', name: 'The Wastes\' reading places', key: 'emberLore' },
];
const TORCH_HOLD_MS = 20 * 60 * 1000;

module.exports = { MS_BOONS, MS_BOONS_BY_ID, ROUNDS, TORCH_HOLD_MS };
