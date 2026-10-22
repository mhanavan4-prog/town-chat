// The Cauldron Café — Daily Special (roadmap #6, room two). Same date-seeded
// daily-collectible pattern as the Forbidden Shelf, warmer register: Barkeep
// Joss chalks up a different brew or dish each day. Order it (once per day,
// logged) to read its little serving-line and add it to your Tasting Menu.
// Taste every one and earn the "Regular at the Cauldron" title. No buffs — the
// collectible is the tasting log; the pull is the rotation + the full menu.
//
// Rotation is `day % CAFE_SPECIALS.length`; tastes are keyed by `id`, so adding
// specials later lengthens the cycle without disturbing logged progress.

const CAFE_SPECIALS = [
  {
    id: 'widows_tea',
    name: "The Widow's Tea",
    desc: 'Smoked black leaf, a thread of orange peel, steeped a minute too long on purpose.',
    taste: 'Joss slides it over without a word and nods up at the ceiling. "On the house when she’s pacing. Don’t ask how I know."'
  },
  {
    id: 'gravemoss_stout',
    name: 'Gravemoss Stout',
    desc: 'Black as a root cellar, a head like churchyard mist. Tastes of bread and old stone.',
    taste: 'Joss draws it slow so the mist settles. "Brewed it in the dark of the moon. Drink it in the dark of anything."'
  },
  {
    id: 'hemlock_cordial',
    name: 'Hemlock-Blossom Cordial',
    desc: 'All of the name and none of the poison — a sweet white-flower syrup over cracked ice.',
    taste: 'Joss grins. "Named to scare the tourists. It’s elderflower. Mostly elderflower. Enjoy."'
  },
  {
    id: 'ember_ashcake',
    name: 'Ember Ashcake',
    desc: 'A dense griddle-cake cooked on a stone pulled straight from the hearth, dusted with fine grey salt.',
    taste: 'Joss flips it off the hot stone with two fingers. "Straight from the Ember Road recipe. Mind your tongue — it bites back warm."'
  },
  {
    id: 'moonmilk_posset',
    name: 'Moonmilk Posset',
    desc: 'Warm spiced milk thickened to a spoonable hush, a skin of nutmeg on top.',
    taste: 'Joss sets it down gently. "For the nights the town’s too quiet. Hold the cup, don’t drink it yet. There. Better."'
  },
  {
    id: 'nightshade_cocoa',
    name: 'Nightshade Cocoa',
    desc: 'Bitter dark cocoa, a whisper of chilli, a violet petal that is absolutely not nightshade.',
    taste: 'Joss floats the petal on top. "Purely decorative. Probably. We’ve had no complaints that could still complain."'
  },
  {
    id: 'bog_myrtle_mead',
    name: 'Bog-Myrtle Mead',
    desc: 'Honey-gold and resinous, brewed with marsh herbs that keep the biting things off.',
    taste: 'Joss wipes the horn cup first. "Wardens drink this before a night in the Wilds. Keeps the midges off. Keeps other things guessing."'
  },
  {
    id: 'cinder_toffee',
    name: 'Cinder Toffee',
    desc: 'Honeycomb toffee snapped into shards, burnt just to the edge of regret.',
    taste: 'Joss snaps a piece off the slab. "Made it black on purpose. The best things in this town are a little burnt."'
  },
  {
    id: 'thornberry_tart',
    name: 'Thornberry Tart',
    desc: 'Dark hedge-berries under a lattice, tart enough to make you blink, picked from where you shouldn’t.',
    taste: 'Joss cuts a wedge. "Picked past the treeline. Don’t tell the Thornwardens. Don’t tell anyone, really."'
  },
  {
    id: 'salt_and_secret_broth',
    name: 'Salt-and-Secret Broth',
    desc: 'A clear, restorative bone broth. The secret is the second ingredient. Joss will not say.',
    taste: 'Joss ladles it steaming. "Salt, and a secret. You tell me a secret, I’ll tell you the salt. No? Then eat."'
  },
  {
    id: 'hagstone_cider',
    name: 'Hagstone Cider',
    desc: 'Cloudy pressed apple poured through a holed stone, for luck or for habit.',
    taste: 'Joss pours it through the old stone on the bar. "Superstition. Costs me nothing and the regulars like it. So. Luck."'
  },
  {
    id: 'first_frost_sorbet',
    name: 'First-Frost Sorbet',
    desc: 'Sharp pear and white wine, frozen the morning the first frost took the garden.',
    taste: 'Joss scrapes a curl into a chilled cup. "Only make it the day the frost comes. Today, it came. Lucky you were in."'
  }
];

module.exports = { CAFE_SPECIALS };
