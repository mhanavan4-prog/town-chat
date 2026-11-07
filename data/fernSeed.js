// ---------------------------------------------------------------------------
// Fern seed: gathered at midnight on St John's Eve (23 June) to walk
// invisible. There was no seed to gather: ferns grow from spores. A caller
// comes on the 23rd and 24th only (FERN_WHEN, by calendar date, UTC).
//
// Sources: Shakespeare, Henry IV, Part 1 (c. 1597), 2.1; Jonson, The New Inn
// (1629), 1.6; on the "seed", R. C. Moran, Fiddlehead Forum 22 (1995), and J.
// Sachs, History of Botany (trans. 1890), on Hofmeister's work of 1849–51.
// Brand, Hone and Chambers could not be read directly, so they are not cited.
// ---------------------------------------------------------------------------
const FERN_WHEN = { month: 6, from: 23, to: 24, label: "St John's Eve" };

const FERN_RITES = {
  fern_seed: {
    key: 'fern_seed', name: 'The Fern Seed', icon: '🍃',
    how: 'At midnight on St John\'s Eve, slide a pewter plate under the fern and catch the seed as it falls, without touching the plant.',
    outcomes: [
      'Midnight comes and goes. The plate is empty, but for a fine brown dust where the fronds hang over it.',
      'Something rustles in the bracken behind you. It is the wind, or a hedgehog. The plate stays empty.',
      'A little brown dust on the pewter. You fold it into a paper. Nobody is invisible in the morning.',
    ],
    lore: 'Fern seed, gathered at midnight on St John\'s Eve, was said to make the bearer invisible. "We have the receipt of fern-seed, we walk invisible," says the thief Gadshill in Shakespeare\'s Henry IV, Part 1, and the Chamberlain answers that he is "more beholding to the night than to fern-seed for your walking invisible." Jonson\'s Ferret had "No fern-seed in my pocket". The seed had to be caught as it fell, on a plate, without touching the fern. There was no seed to catch. Ferns grow from spores, the brown dust on the underside of the fronds, which Malpighi was looking at under the microscope in the late 1600s; how a fern grows from one was worked out only in the 1840s.',
    tier: 'record',
    source: 'W. Shakespeare, Henry IV, Part 1 (c. 1597), 2.1 · B. Jonson, The New Inn (1629), 1.6 · R. C. Moran, Fiddlehead Forum 22 (1995) · J. Sachs, History of Botany (trans. 1890), on Hofmeister',
  },
};

module.exports = { FERN_RITES, FERN_WHEN };
