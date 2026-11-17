// The Wild Hunt: by night, for those who have the besom (Level 20), the Hunt's
// horns sound in a line across the sky over the Wilds. Ride through each, in
// the order they sound, before dawn, and you have ridden with the Hunt.
//
// It gives no power: the rewards are titles and the look of the besom's wake.
const HUNT = {
  rings: 9,            // horns to ride through in a night
  radius: 110,         // how near the middle of a horn-ring counts (across)
  reach: 90,           // and how near in height
  minAlt: 180, maxAlt: 900,   // the course keeps above everything on the ground
  margin: 1400,        // rings keep this far in from the edge of the Wilds
  stride: [900, 1700], // how far it is from one ring to the next
  // nights ridden -> what it gives. A title id is in data/titles.js; a wake is the besom's trail.
  ranks: [
    { nights: 1, title: 'hunt_rider', wake: 'ash' },
    { nights: 3, title: 'hunt_horn', wake: 'frost' },
    { nights: 7, title: 'hunt_herla', wake: 'ember' },
    { nights: 13, title: 'hunt_master', wake: 'moon' },
  ],
};

const HUNT_LORE = {
  tier: 'record',
  lore: 'In 1127 the Peterborough Chronicle sets down that many men saw and heard a great company of hunters, black and huge and hideous, riding black horses and black he-goats with black wide-eyed hounds, in the deer park of Peterborough and in all the woods from there to Stamford; and that the monks heard the horns blown in the night, twenty or thirty of them by the count of those who kept watch.',
  source: 'The Anglo-Saxon Chronicle, Peterborough manuscript (E), under the year 1127. The rider who cannot dismount is King Herla, in Walter Map, De Nugis Curialium (c.1181-1193).',
  note: 'The chronicle has the Hunt seen and heard from the ground. That a witch may ride up among the horns, that there is a course to follow and that anything is given for it, is the game\'s.',
};

const HUNT_WAKES = {
  ash:   { name: 'Ash wake',   color: 0x8a8478 },
  frost: { name: 'Frost wake', color: 0xbfe6ff },
  ember: { name: 'Ember wake', color: 0xff7a3c },
  moon:  { name: 'Moon wake',  color: 0xf4f0d8 },
};

module.exports = { HUNT, HUNT_LORE, HUNT_WAKES };
