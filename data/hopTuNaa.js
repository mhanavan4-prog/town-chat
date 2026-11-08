// ---------------------------------------------------------------------------
// Hop-tu-Naa: Hollantide Eve on the Isle of Man, 31 October (11 November in
// the old calendar), the last night of the Celtic year. Boys went round the
// doors with turnips on sticks, singing, for herrings and potatoes; women baked
// the dumb cake to dream of their husbands; children still go round singing,
// with turnip lanterns, "moots". The caller is dated by the Commonplace Book's
// own entry (when: { calendar: 'hop_tu_naa' }).
//
// Sources: A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI, in F.
// Coakley's transcription; Culture Vannin, "Hop tu Naa" and its leaflet (2018)
// and "Which Hop tu Naa do you sing?" (2020); S. Miller, "How old is 'Jinny
// the Witch'?", Manx Notes 144 (2013); the Scouts on carving; Buckinghamshire
// Fire & Rescue and the London Fire Brigade on Hallowe'en safety. The name's
// origin is uncertain: Moore spells the refrain "Hog-annaa" and ties it to
// Hogmanay; "this is the night" is a popular explanation, given as such.
// The salt heaps and the footprint in the ashes are Moore's New Year's Eve, so
// they are not given here.
// ---------------------------------------------------------------------------
const HOP_RITES = {
  hop_tu_naa: {
    key: 'hop_tu_naa', name: 'Hop-tu-Naa', icon: '🏮',
    how: 'Hollow out a turnip for a moot lantern, and go round the doors with the children on Hollantide Eve, singing Hop-tu-Naa; and let the women of the house bake the dumb cake and go to bed without a word.',
    outcomes: [
      'Moots glowing all down the street. At every door the song, and at every door a coin, or a bun, or a bag of nuts.',
      'The old way: a turnip on a stick knocked on the door, and the woman of the house gives herrings and potatoes.',
      'The dumb cake is baked, eaten in silence, and the women go to bed backwards. In the morning nobody will say what they saw.',
    ],
    lore: 'On the Isle of Man, Moore wrote in 1891, "October 31st and November 11th are the present and past dates, in accordance with the change in the Calendar" of Hollantide, "the first day of the Celtic year": the night before was "undoubtedly the last night of the year". The boys went round singing "This is old Hollantide night", and "carried big sticks with cabbages or turnips stuck in the top, and with these they knocked at people\'s doors till they received herrings and potatoes and such-like gifts". At home "a cake is made, called Soddag valloo, or dumb cake", eaten in silence; the women went to bed backwards, and "in the course of the night they expect to see the images of the men who are destined to be their husbands." Moore spelled the old refrain "Hog-annaa", and thought of Hogmanay; "this is the night" is the popular reading, but no one is sure. Today children carry moots, hollowed turnips, and sing "Jinny the witch flew over the house", a newer verse first found in 1900; Culture Vannin calls Hop-tu-Naa "one of the oldest continuously-existing traditions in the Isle of Man".',
    tier: 'record',
    source: 'A. W. Moore, The Folk-Lore of the Isle of Man (1891), ch. VI · Culture Vannin, "Hop tu Naa" · S. Miller, "How old is \'Jinny the Witch\'?", Manx Notes 144 (2013)',
  },
};

module.exports = { HOP_RITES };
