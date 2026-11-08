// ---------------------------------------------------------------------------
// Hunting the gowk, 1 April (Scotland): the April fool is sent from place to
// place with a letter that reads only "On the first day of April / Hunt the
// gowk another mile". The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'hunt_the_gowk' }).
//
// Sources: W. Hone, The Every-Day Book, vol. I (1826), 1 April, cols. 411–12,
// citing Brand; J. Jamieson, An Etymological Dictionary of the Scottish
// Language (1808), in the 1818 abridgement; the Dictionary of the Scots
// Language, "gowk" (for Ramsay, 1728); Dawks's News-Letter (2 April 1698) as
// Notes and Queries (1913) printed it, Aubrey's "Fooles holy day", and the
// Hampshire noon rule (Notes and Queries, 1855), all as A. Boese gives them
// (second-hand); respectme and the Scottish Government's Respect for All on
// teasing and bullying; Action Fraud and the NCSC on fake messages; the SHARE
// checklist. Left out: Chambers' Book of Days, which couldn't be read; the
// "Dinna laugh, dinna smile" rhyme, which only later sources give; and
// Chaucer's "thritty dayes and two" as an April fool, which scholars think a
// copyist's slip.
// ---------------------------------------------------------------------------
const GOWK_RITES = {
  hunt_the_gowk: {
    key: 'hunt_the_gowk', name: 'Hunting the Gowk', icon: '🐦',
    how: 'On the first of April write "On the first day of April / Hunt the gowk another mile" on a paper, fold it, and send the gowk off with it to a neighbour on an errand of great importance; the neighbour reads it, keeps a straight face, and sends him on another mile.',
    outcomes: [
      'The letter is folded small and sealed with a thumb. Off goes the gowk to the smithy at a run, on great business.',
      'The smith reads it, frowns, and says this wants the miller. Off goes the gowk again, another mile.',
      'At the third door they laugh and give him a scone, and he laughs too. By noon the game is done for the year.',
    ],
    lore: 'In Scotland, Hone wrote in 1826, the April fool was sent "from place to place by means of a letter, in which is written / \'On the first day of April / Hunt the gowk another mile.\'", and "This is called \'hunting the gowk;\' and the bearer of the \'fools\' errand\' is called an \'April gowk.\'" Brand had it before him, and "says, that gowk is properly a cuckoo, and is used here metaphorically for a fool". Jamieson\'s dictionary (1808) gives both, "A fool" and "The cuckoo", and "To hunt the gowk, to go on a fool\'s errand"; Allan Ramsay\'s Hermes asks in 1728 whether Jove has sent him "here to hunt the Gowk". Later tellers have each reader send the bearer on to the next house. England kept the day too: Aubrey noted the "Fooles holy day" in the 1680s, and on 1 April 1698 people were sent to the Tower ditch "to see the Lions washed" (Dawks\'s News-Letter). In Hampshire by 1855 the fooling stopped at noon, and whoever tried it after was the fool himself.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. I (1826), 1 April, cols. 411–12 · J. Jamieson, An Etymological Dictionary of the Scottish Language (1808), "Gowk" · Dictionary of the Scots Language, "gowk" · Dawks\'s News-Letter (2 April 1698), in A. Boese, The Museum of Hoaxes',
  },
};

module.exports = { GOWK_RITES };
