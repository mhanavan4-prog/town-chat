// Ashminster, living in (lib/ashFolk.js). The town round the minster is empty
// until someone is seen to keep it. As you do (as the Knight does in Episode
// III, or anyone does for Dame Isolt), people come back to it, one at a time,
// and each takes up a trade there. What you see is your own: the town fills as
// your own story goes on.
//
// What brings each back: 'arrived' (you have come to Ashminster), 'heard' (you
// have spoken at the anchoress's squint, or laid the field for her), 'watched'
// (you have stood the watch: the Knight's last chapter, or Isolt's long one).
const X = 10000, Y = 11000;   // the minster (data/emberTown.js EMBER_TOWN)

const FOLK = [
  {
    id: 'kirsty', npcId: 'npc_windseller', name: 'Kirsty Halcrow, the wind-seller', icon: '🪢', charId: 0,
    x: X + 270, y: Y + 2060, facing: Math.PI, after: 'arrived',
    empty: '🪢 A stall by the market cross with a board over it and nothing on the board. Somebody meant to come back to it. Perhaps when the minster is seen to.',
    back: '🪢 Kirsty Halcrow has come back to her stall by the cross. "There is a wind in every knot," she says, "and there are storms out here that want answering."',
    tier: 'record',
    lore: [
      'Up the coasts of the north, in Orkney and Shetland, Lewis and the Isle of Man, and right across Scandinavia, there were women who sold winds. A sailor going out bought a fair wind before he went: a cord, or a strip of cloth, tied in three knots. Loose the first and you would have a breeze; the second, a good strong wind; the third was never to be loosed, for it held a gale.',
      'Olaus Magnus wrote of the Finns selling knotted winds to merchants in 1555. Walter Scott, sailing round the northern isles in 1814, climbed up to the house of an old woman at Stromness who sold winds to sailors for sixpence, and noted it in his diary.',
    ],
    source: 'Olaus Magnus, Historia de Gentibus Septentrionalibus (1555), book III; Walter Scott\'s diary of 1814, in J. G. Lockhart, Memoirs of the Life of Sir Walter Scott.',
    note: 'In the record a knot held a wind for a ship. In the game, loosed in an ash storm, a knot of her wind blows the ash back off you for a minute.',
  },
  {
    id: 'wat', npcId: 'npc_sexton', name: 'Wat Ellery, the sexton', icon: '🔔', charId: 4,
    x: X + 900, y: Y + 520, facing: -Math.PI / 2, after: 'heard',
    empty: '🔔 A bell-rope hangs down the outside of the tower, its end tied up out of reach. Nobody has rung it since the war.',
    back: '🔔 Wat Ellery has come back to the tower and untied the rope. "Somebody laid them. Somebody had better ring for them," he says. "Take hold. I\'ll count."',
    tier: 'record',
    says: '🔔 You take the rope with him and he counts the strokes aloud: three, and three, and three, nine tellers for a man, and then one for every year of a life nobody knows. It carries a long way over the ash.',
    lore: [
      'The passing bell was rung when someone in the parish was dying, so that those who heard it would pray for the soul on its way out. The Canons of 1604 ordered it: when anyone is passing out of this life a bell shall be tolled, and the minister shall not then slack to do his last duty.',
      'In many places the strokes told who it was. Before the tolling came the tellers: three strokes for a child, three times two for a woman, three times three for a man. Then, often, a stroke for every year of the life. "Nine tailors make a man" is said to come from nine tellers.',
    ],
    source: 'The Constitutions and Canons Ecclesiastical of 1604, canon 67; for the tellers, Henry Thomas Ellacombe, Practical Remarks on Belfries and Ringers (1859), and Dorothy L. Sayers, who built a novel on them, The Nine Tailors (1934).',
    note: 'The sexton, and the bell rung for the field\'s dead, are the game\'s.',
  },
  {
    id: 'nan', npcId: 'npc_wellwife', name: 'Nan Gethin, who keeps the well', icon: '🌸', charId: 2,
    x: X + 420, y: Y + 2230, facing: Math.PI * 0.75, after: 'watched',
    empty: '🌸 The town well, with its rope cut and a skin of ash on the water. Nobody has dressed it in years.',
    back: '🌸 Nan Gethin has come back and dressed the well: a board pressed with clay and set with petals and seeds and bits of bark, a picture of the minster standing. "Drink," she says. "It is sweet again."',
    tier: 'record',
    says: '🌸 You drink from the dressed well. The water is cold and tastes of stone, and nothing of ash. You are mended.',
    lore: [
      'Well-dressing is done in Derbyshire and Staffordshire villages every summer. Boards are soaked in a pond, plastered with wet clay, and a picture is pressed into the clay with petals, seeds, moss, bark, cones and berries, so that from a few steps off it looks painted. The boards are set up over the wells and blessed.',
      'Tissington claims the oldest; a firm record of it is from the eighteenth century, and stories put it earlier, as thanks for wells that ran clean through the plague of 1348 or the drought of 1615. Most villages took it up or took it back in the nineteenth and twentieth centuries.',
    ],
    source: 'Ronald Hutton, The Stations of the Sun (1996); Christopher Porteous, The Beauty and Mystery of Well-Dressing (1949).',
    note: 'The well at Ashminster, and its mending, are the game\'s.',
  },
];
const FOLK_BY_ID = Object.fromEntries(FOLK.map((f) => [f.id, f]));

const ASH_FOLK = {
  range: 190,
  bellXp: 25,        // ringing for the dead with Wat, once a day
  wellHeal: 1,       // the dressed well: all your health, once a day
  knotMs: 60 * 1000, // a loosed knot keeps the ash off you this long
  knotPrice: 35,
};

module.exports = { FOLK, FOLK_BY_ID, ASH_FOLK };
