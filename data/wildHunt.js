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

// The night company: a coven riding the Hunt together.
// Members of one coven who ride close together share the horns: when one rides
// through a horn, it counts for every one of her coven riding within reach who
// was after the same horn. When two or more of a coven finish the Hunt on the
// same night, the coven has ridden in company: the night is counted for the
// coven, and each who rode is given the company's title.
const COMPANY = {
  reach: 700,     // how near another of the coven must be riding for a horn to count for her too
  needs: 2,       // how many of a coven must finish in one night for it to be a night in company
  title: 'hunt_company',
};
const COMPANY_LORE = {
  tier: 'record',
  lore: 'The Canon Episcopi, set down by Regino of Pr\u00fcm about 906, speaks of women who believe that in the dead of night they ride on beasts with Diana, goddess of the pagans, in a countless company of women, and cross great distances of the earth in the silence of the night.',
  source: 'Regino of Pr\u00fcm, Libri duo de synodalibus causis (c.906), the passage later called the Canon Episcopi.',
  note: 'The canon records the belief in order to call it a delusion. That a coven riding close shares the horns, and that anything is given for riding in company, is the game\'s.',
};

module.exports = { HUNT, HUNT_LORE, HUNT_WAKES, COMPANY, COMPANY_LORE };
