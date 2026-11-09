// ---------------------------------------------------------------------------
// The Dog Days, 3 July to 11 August in the later almanacs: the dog-star,
// Sirius, rising with the sun and doubling its heat, when dogs went mad,
// physic was dangerous and wounds healed badly. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'dog_days' }), on the day
// they begin.
//
// Sources: Hesiod, Works and Days, tr. H. G. Evelyn-White (1914); Pliny,
// Natural History, tr. Bostock and Riley, 2.40 and 8.63; E. C. Brewer,
// Dictionary of Phrase and Fable (1895), "Dog-days"; W. Vaughan, Approved
// Directions for Health (1612), p. 126, and J. Achelley, The Key of Knowledge
// (1572), read in EEBO-TCP; W. Hone, The Every-Day Book, vol. I (1826), 3 July
// and 11 August, after Butler, Hutton and Brady; the NHS on heat exhaustion;
// UKHSA on hot weather; the British Veterinary Association, for the Dogs Die
// in Hot Cars coalition; Dogs Trust on pavements. Left out: the 1662 Prayer
// Book as a source for the dates (no dog days in its calendar), Pliny in
// words he doesn't use, "it can take just minutes", and a seven-second
// pavement test (Dogs Trust says five).
// ---------------------------------------------------------------------------
const DOG_RITES = {
  dog_days: {
    key: 'dog_days', name: 'The Dog Days', icon: '🐕',
    how: 'When the dog days begin, tie up or muzzle the dogs and give them water and shade; take no physic till they are past; work early and late, and rest in the heat of the day, for the dog-star is up with the sun and doubles its heat.',
    outcomes: [
      'The dog is tied in the shade of the barn with a pail of water. He sulks, but he is cool.',
      'Work starts at first light and stops at eleven. The street lies empty and shuttered till the heat goes off.',
      'Old Mother Peake will take no physic till the eleventh of August, and nobody can make her.',
    ],
    lore: 'Hesiod knew the season when "Sirius parches head and knees and the skin is dry through heat." Pliny asked "Who is there that does not know that the vapour of the sun is kindled by the rising of the Dog-star?", and added that "dogs, during the whole of this period, are peculiarly disposed to become rabid": "Canine madness is fatal to man during the heat of Sirius." English doctors took it on: "It is dangerous taking of Physicke, and specially in the Dog dayes. To heale wounds is very difficult and perillous" (Vaughan, 1612). Brewer (1895) gives the dates, "July 3rd to August 11th", when "the dog-days bore the combined heat of the dog-star and the sun"; but older almanacs had other days, 10 July to 20 August in 1572, and Hone (1826) printed Butler\'s verdict that the almanac dates were "a palpable mistake, since the heliacal rising of this star does not now take place, at least in our latitude, till near the latter end of August." Hone, advising on dog bites, wrote "as at this time dogs go mad", and Cambridge in 1824 ordered dogs to be muzzled or tied up, though Brady called the star\'s effects "groundless".',
    tier: 'record',
    source: 'Hesiod, Works and Days, tr. Evelyn-White (1914) · Pliny, Natural History, tr. Bostock and Riley, 2.40, 8.63 · W. Vaughan, Approved Directions for Health (1612), p. 126 · J. Achelley, The Key of Knowledge (1572) · W. Hone, The Every-Day Book, vol. I (1826), 3 July · E. C. Brewer, Dictionary of Phrase and Fable (1895), "Dog-days"',
  },
};

module.exports = { DOG_RITES };
