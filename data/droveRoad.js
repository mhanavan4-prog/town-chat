// The drove road (lib/droveRoad.js): the old green way east from the gibbet
// crossroads in the Wilds to the March gate, and through it into the west of
// the Ember Wastes. Before the war the cattle came along it; now nothing does.
// A milestone, the three pines of a drovers' stance, a need-fire hearth, and
// the gate. Out of the Wastes it is open at any hour (the way out when the
// temple portal has gone dark); in, only while the temple's four torches burn,
// as the portal itself.
//
// Placed clear of Troy Town (7000, 7900) and the Countless Stones (8600, 6600).
const ROAD = {
  // the way itself, from the crossroads at the gibbet (data/wayside.js) to the gate
  pts: [[5150, 7200], [6300, 7320], [7450, 7260], [8550, 7330], [9620, 7300]],
  width: 170,
  range: 190,
  eachXp: 15,
  walkedXp: 40, walkedGold: 20,
  stanceHeal: 0.5,                 // the pines: rest at the stance, half your health back
  needfireMs: 10 * 60 * 1000,      // the smoke stays on you this long
  needfireCut: 0.15,               // and the Wastes' creatures hurt you this much less
};

// The March gate, on each side.
const GATE = {
  wilds: { x: 9680, y: 7300 },                       // at the east edge of the Wilds
  wastes: { x: 560, y: 13100 },                      // at the west edge of the Ember Wastes
  arriveWastes: { x: 860, y: 13100 },                // where you come through, in the Wastes
  arriveWilds: { x: 9440, y: 7300 },                 // and where you come back, in the Wilds
  quiet: 900,                                        // nothing of the Wastes rises this near the gate
};

const STOPS = [
  {
    id: 'milestone', icon: '🪨', name: 'The drovers\' milestone', x: 6300, y: 7180, model: 'wd_milestone', size: 90, hint: 'read the milestone',
    tier: 'record',
    says: '🪨 ASHMINSTER, and a number the weather has had. Somebody has scratched a cow\'s head under it, the way drovers marked a road as theirs.',
    lore: [
      'Before the railways, cattle walked to market. From the Highlands to the trysts at Crieff and Falkirk, and on south over the Border to the fairs and to Smithfield; from Wales over the hills into England. Drovers took them in herds of a few hundred at ten or twelve miles a day, with dogs, sleeping out or at a stance, a halting place with grazing.',
      'The drove roads were wide green ways across open country. When the turnpikes came, with a toll at every gate, the drovers kept off them where they could: a toll for every beast in a herd of hundreds was ruin, and the beasts went better on grass than on stone.',
    ],
    source: 'A. R. B. Haldane, The Drove Roads of Scotland (1952); K. J. Bonser, The Drovers (1970).',
    note: 'The town on the stone, and the war that ended the droving, are the game\'s.',
  },
  {
    id: 'pines', icon: '🌲', name: 'Three pines at the stance', x: 7450, y: 7060, model: 'wd_scots_pine', size: 330, hint: 'rest at the drovers\' stance',
    tier: 'folk',
    says: '🌲 You sit with your back to the middle pine, where the ground is worn flat by a great many people sitting. The wind goes over and not through. You get up mended.',
    lore: [
      'All over England and Wales it is said that three Scots pines standing together mark where drovers could stop: an inn that took them, or a farm with a field to let for the night. The pines were tall enough to be seen from miles off across open country, and a drover coming up the road knew what they meant.',
      'It is a tradition rather than a record. Some groups of three pines do stand by old inns on drove roads; many more were planted for no such reason. Nobody has found a drover writing it down.',
    ],
    source: 'Widely told in England and Wales; discussed as a tradition in Bonser, The Drovers (1970), and in local histories of the drove roads.',
    note: 'In the game the stance mends you once a day.',
  },
  {
    id: 'needfire', icon: '🔥', name: 'The need-fire hearth', x: 8550, y: 7560, model: 'wd_needfire', size: 170, hint: 'kindle the need-fire',
    tier: 'record',
    says: '🔥 You put your weight on the drill and turn it until the wood smokes, and smokes, and a coal drops in the tinder. No fire was struck to make it. You stand in its smoke the way the beasts were driven through it.',
    lore: [
      'Need-fire was fire made new, by rubbing wood on wood, when murrain was on the cattle. Every fire in the township was put out first, every hearth cold. Then the new fire was kindled, often with a turning spindle worked by a rope, sometimes by a set number of men, and the beasts were driven through its smoke. Afterwards each household carried a brand home to light its hearth again.',
      'It was done in Scotland, the north of England, Ireland and across Germany and Scandinavia, and it was still being done in the Highlands in the nineteenth century, in the teeth of the kirk.',
    ],
    source: 'J. G. Frazer, The Golden Bough (abridged 1922), in the chapter on the fire-festivals of Europe, which gathers accounts of the need-fire from Britain, Germany and Scandinavia; Martin Martin, A Description of the Western Islands of Scotland (1703).',
    note: 'In the record it was against sickness in cattle. In the game its smoke stays on you a while, and the creatures of the Wastes bite you less.',
  },
  {
    id: 'gate', icon: '🪨', name: 'The march stone', x: GATE.wilds.x - 60, y: GATE.wilds.y + 230, model: 'wd_milestone', size: 120, hint: 'read the march stone',
    tier: 'record',
    says: '🪨 The march stone by the gate. Past it the grass stops as if cut, and the ground goes black, and the air smells of old fire. That is the Wastes.',
    lore: [
      'A march is a boundary, and a march stone marks one. In the Border towns of Scotland the bounds of the burgh\'s common land are still ridden every year: at Hawick, Selkirk, Jedburgh, Langholm and others the Common Riding goes out on horseback round the marches, as it has since the days when a boundary that was not ridden was a boundary another town could take.',
      'In England the same work was done on foot at Rogationtide, beating the bounds: the parish walked its boundary, and at each stone the boys were bumped on it, or beaten with willow wands, so that they would remember where it was when they were old.',
    ],
    source: 'The Common Ridings of the Scottish Border towns (Selkirk and Hawick both trace theirs to the early sixteenth century); for beating the bounds, Ronald Hutton, The Stations of the Sun (1996).',
    note: 'The gate, and what lies past it, are the game\'s.',
  },
];
const STOPS_BY_ID = Object.fromEntries(STOPS.map((s) => [s.id, s]));

// The last drove (lib/ghostDrove.js): some nights, when someone comes to the
// March gate in the dark, a herd that is not there comes through it and goes
// west down the road to the crossroads, pale beasts and a drover behind them.
// Keep behind it and see it to the crossroads; get in among them and you are
// knocked down; fall too far back and it is gone. Once a night each.
const HERD = {
  tier: 'folk',
  path: [...ROAD.pts].reverse(),   // from the gate west to the crossroads
  beasts: 8,
  speed: 105,
  standMs: 6000,       // they stand at the gate first: time to get off the road
  wake: 260,           // how near the gate, by night, before they come
  lose: 480, loseMs: 5000,
  cross: 75,           // nearer than this to a beast is in among them
  ahead: 110, beside: 120,
  struck: 0.2,
  xp: 70,
  lore: [
    'The best known herd that was not of this world is the one that went into Llyn y Fan Fach, a lake under the Black Mountain in Carmarthenshire. A young man of Blaensawdde married a woman who came out of the lake, and she brought her cattle with her out of the water. She warned him that if he struck her three times without cause she would go. When the third causeless blow fell she called her cattle by name, every one, and they rose and followed her back into the lake: the cows, the calves, the bull, and the four grey oxen that were ploughing, dragging the plough behind them. The furrow it cut up the hillside to the water was shown to visitors.',
    'Her sons stayed, and she came back to teach them the use of herbs. They were said to be the Physicians of Myddfai, a line of real healers whose book of remedies survives from the fourteenth century.',
  ],
  source: 'W. Rees, The Physicians of Myddvai (1861), and John Rhys, Celtic Folklore, Welsh and Manx (1901), who took down the tale; the remedies are in the Red Book of Hergest.',
  note: 'The story of the lake cattle is well recorded. A ghost drove going down a drove road is the game\'s own.',
};

module.exports = { ROAD, GATE, STOPS, STOPS_BY_ID, HERD };
