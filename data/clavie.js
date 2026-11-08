// ---------------------------------------------------------------------------
// The Burning of the Clavie, Burghead, Moray: on 11 January, old Hogmanay
// (New Year's Eve before the calendar changed in 1752), a half tar-barrel on
// a pole, filled with tar and wood and lit with a peat, is carried burning
// round the town and set on a stone pillar on the Doorie hill; the embers are
// taken home for luck. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'clavie' }).
//
// Sources: the Banffshire Journal's account, reprinted in R. Chambers, The
// Book of Days (1864), 31 December, and in A. Mitchell, "Vacation Notes in
// Cromar, Burghead, and Strathspey", Proceedings of the Society of
// Antiquaries of Scotland 10 (1875), pp. 648–50; the Duffus Kirk Session (7
// January 1666) and Elgin Presbytery (1655), as the Dictionary of the Scots
// Language gives them; VisitScotland; Museums Galleries Scotland, Intangible
// Cultural Heritage; the Scottish Fire and Rescue Service; the NHS; Humberside
// Fire and Rescue on hot ashes. Left out: a Duffus Kirk Session of 1704
// calling it "idolatrous", which couldn't be placed (the 1655 presbytery
// words are about torches, and say so), and anything from the Statistical
// Accounts, which couldn't be read.
// ---------------------------------------------------------------------------
const CLAVIE_RITES = {
  clavie: {
    key: 'clavie', name: 'Burning the Clavie', icon: '🔥',
    how: 'Saw a tar-barrel in two, nail the smaller half to a pole with a smith-made nail driven home with a stone, fill it with tar and wood, light it with a peat from the fire, and carry it burning round the town to the hill; then scatter it, and take an ember home.',
    outcomes: [
      'The clavie goes up from a peat with a roar. Round the houses it goes on the bearers\' shoulders, dripping fire.',
      'On the hill they set it on the stone pillar and heap on more wood. The whole town\'s faces glow orange in the dark.',
      'It comes down at last and everyone rushes for an ember. Yours goes home in an old tin, for the year\'s luck.',
    ],
    lore: 'At Burghead in Moray the New Year is still kept on 11 January, "known as \'old Hogmanay\'" (VisitScotland), by burning the clavie. First "the tar-barrel is sawn into two unequal parts; the smaller forms the groundwork of the Clavie"; it is nailed to a pole, the "spoke", with "a long nail, made for the purpose, and furnished gratuitously by the village blacksmith", and no hammer may drive the nail, which is "sent home" by a smooth stone. It is lit with a peat, for "no sulphurous lucifer, no patent congreve, dare approach within the sacred precincts of the Clavie". Carried round the town, it is set on the Doorie hill on "a freestone pillar, very much resembling an ancient altar", fed with fresh fuel, and at last broken up; its firebrands were once thought "a sure safeguard against all unlucky contingencies" (the Banffshire Journal, in Chambers, 1864). The Kirk did not like it: in 1666 the Duffus Kirk Session called up "sex skippers" for "burning their clavies upon Satturday last before new yeires even". The embers still kindle New Year fires in Burghead, and are sent to Burghead folk far away.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 31 December · A. Mitchell, Proceedings of the Society of Antiquaries of Scotland 10 (1875), pp. 648–50 · Dictionary of the Scots Language, "Clavie" · VisitScotland, "Hogmanay" · Museums Galleries Scotland, "Burning the Clavie"',
  },
};

module.exports = { CLAVIE_RITES };
