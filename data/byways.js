// By-ways of the Wilds (lib/byways.js): three small places off the roads, each
// out of the record or out of folk tradition, each saying which, with its
// source and a note of where the game goes past it.
//
//   👞 the shoe in the chimney — a roofless cottage, and what was put in its flue
//   🪨 the Devil's stone       — a boulder that has to be turned over
//   🕳️ Hob's hole              — a hole in a bank, and who was asked for what
//
// Each may be used once a day; pressing again that day reads its history. All
// three in a day is the by-ways walked.
const BYWAYS = [
  {
    id: 'shoe', icon: '👞', name: 'The shoe in the chimney', x: 6400, y: 5300, model: 'wd_ruin_hearth', size: 300, turn: 0.4,
    hint: 'look up the chimney',
    tier: 'record',
    says: '👞 You put your head in the hearth and look up. On a ledge in the flue, black with soot, there is a shoe: one, small, worn through at the toe and mended twice. Nobody dropped it there. You leave it where it is.',
    lore: [
      'Old shoes are found hidden in old houses all over Britain: one shoe, almost never a pair, nearly always worn out and often mended, about half of them children\'s. They turn up when a chimney is opened or a floor lifted. Northampton Museum keeps an index of the finds; by 2012 it held about 1,900. Just over a quarter were in the chimney, fireplace or hearth, and nearly as many under a floor or above a ceiling, with the roof close behind. The oldest was behind the choir stalls of Winchester Cathedral, which were put in in 1308.',
      'Nobody who hid one wrote down why. Most who have studied them think they were set at the ways into a house, the chimney above all, to keep harm out. Ralph Merrifield pointed to John Schorn, rector of North Marston in Buckinghamshire, of the fourteenth century, who was said to have conjured the Devil into a boot.',
    ],
    source: 'June Swann, "Shoes Concealed in Buildings", Costume 30 (1996), from the Concealed Shoe Index at Northampton Museum; Ralph Merrifield, The Archaeology of Ritual and Magic (1987); Brian Hoggard, Magical House Protection (2019).',
    note: 'The finds are well recorded; the reason is the scholars\' best reading, not anything written at the time. The cottage is the game\'s.',
  },
  {
    id: 'stone', icon: '🪨', name: 'The Devil\'s stone', x: 3700, y: 3950, model: 'wd_devil_stone', size: 190, turn: 0,
    hint: 'put your weight to the bar and turn the stone',
    tier: 'folk',
    says: '🪨 You get the bar under it and lean. It comes up slowly, hangs, and goes over with a thump you feel in your feet. The pale side is uppermost now. That is this year seen to.',
    lore: [
      'On the green at Shebbear in Devon, outside the inn that is named for it, lies a boulder of about a ton, six feet by four. Every fifth of November, after dark, the ringers go up the tower and ring the bells in a jangle, all out of order; then they come down with crowbars and turn the stone over, and the parson tells how it came there. It is said that St Michael dropped it on the Devil, and that if it is not turned the year will go badly for the village.',
      'It is still done. How old it is nobody can show: Steve Roud looked and found no record of it before the twentieth century.',
    ],
    source: 'Steve Roud, The English Year (2006); the custom as kept at Shebbear, Devon, each 5 November.',
    note: 'At Shebbear it is turned once a year by the ringers. In the game it may be turned once a day, by anybody.',
  },
  {
    id: 'hob', icon: '🕳️', name: 'Hob\'s hole', x: 8300, y: 8700, model: 'wd_hob_hole', size: 260, turn: 2.6,
    hint: 'call into Hob\'s hole',
    tier: 'folk',
    says: '🕳️ You stand at the mouth and say it into the dark, three times, the way it was said: take it off, take it off. Nothing answers. But you go away lighter than you came.',
    lore: [
      'In the cliff at Runswick Bay on the Yorkshire coast is a cave called Hob Hole, and a hob lived in it. When a child had the whooping cough, which they called the kink-cough, its mother carried it down to the cave at low water, stood at the mouth with the child in her arms, and called to him: Hob, hob, my bairn\'s getten t\' kink-cough; tak it off, tak it off.',
      'It was written down in 1889 by a visitor who said that some mothers still believed in it. By then the cave, once a hundred feet deep, had been much shortened by men digging the cliff for jet.',
    ],
    source: '"A Ramble in North Yorkshire", Old Yorkshire (1889); the rhyme is given in more than one form.',
    note: 'Hob was asked to take a child\'s cough. That he mends a grown traveller is the game\'s.',
  },
];
const BYWAYS_BY_ID = Object.fromEntries(BYWAYS.map((b) => [b.id, b]));

const BYWAY = {
  range: 170,
  eachXp: 15,
  hobHeal: 0.35,                 // Hob's hole: this share of your health back
  walkedXp: 40, walkedGold: 20,  // all three in one day
};

module.exports = { BYWAYS, BYWAYS_BY_ID, BYWAY };
