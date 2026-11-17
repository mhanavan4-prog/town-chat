// Macros: a chain of your own abilities on one button.
//
// A macro casts its abilities one after another, in the order you put them. It is a convenience and nothing more:
// every step is an ordinary cast, sent as you would have sent it, with its own cooldown and the server's usual
// checks, so a macro can do nothing that pressing the buttons in turn could not. What it buys is room on the
// screen. Everyone has short ones; longer ones are bought with Moonstones, once, for the account.
const MACROS = {
  slots: 3,            // how many macros a class can keep
  baseSteps: 2,        // how long a macro can be to begin with
  nameMax: 16,
  gapMs: 450,          // between one step's cast and the next (client)
  // each size is bought in turn: { steps, cost in Moonstones }
  sizes: [
    { steps: 3, cost: 20 },
    { steps: 4, cost: 40 },
    { steps: 5, cost: 70 },
    { steps: 6, cost: 110 },
  ],
};
// Abilities that ask another player's leave (her camera, her whereabouts) are never cast from a chain.
const MACRO_BARRED_EFFECTS = ['camera', 'howl_location'];
const MACRO_ICONS = ['⛓️', '🔥', '🌙', '🗡️', '🛡️', '✨', '🌿', '💀'];

module.exports = { MACROS, MACRO_BARRED_EFFECTS, MACRO_ICONS };
