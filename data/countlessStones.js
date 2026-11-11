// ---------------------------------------------------------------------------
// The Nine-and-Twenty: a stone circle in the Wilds that no one counts the
// same twice. You count it yourself, by eye, walking round it: every stone,
// standing or fallen. Count it twice; the old writers said the two counts
// would never agree.
//
// The game does not cheat: the ring has a fixed number of stones (some
// fallen, some small, some hidden behind their neighbours from where you
// stand), and the server knows it. Count it right twice running and the
// record is beaten.
//
// Tiers: the belief that the stones "cannot be counted twice alike" is
// record, written down from before 1586 (Sidney, of Stonehenge) to 1698
// (Fiennes, of Long Meg). The baker's loaves and the illness at Stanton Drew
// are folk tales collected later. The modern story that a true count wakes a
// coven at Long Meg rests on a source we could not date, and is left out.
// ---------------------------------------------------------------------------
const COUNTLESS = { x: 8600, y: 6600, radius: 165 }; // in the east of the Wilds, north-east of the portal
// The stones round the ring: angle (degrees, 0 = east, increasing sunwise),
// and what each is: 's' standing, 'f' fallen, 'l' low stump.
const COUNTLESS_STONES = [
  [0, 's'], [11, 's'], [22, 'l'], [31, 's'], [45, 's'], [56, 'f'], [64, 's'], [77, 's'],
  [90, 's'], [99, 'l'], [112, 's'], [124, 's'], [133, 's'], [147, 'f'], [158, 's'], [170, 's'],
  [181, 's'], [194, 'l'], [205, 's'], [214, 's'], [228, 's'], [239, 'f'], [250, 's'], [263, 's'],
  [271, 's'], [284, 's'], [296, 'l'], [305, 's'], [318, 's'], [331, 'f'], [345, 's'],
];
const COUNTLESS_N = COUNTLESS_STONES.length;

// What two counts in a row say. first/second are the player's numbers.
function countlessVerdict(first, second) {
  if (!Number.isInteger(first) || !Number.isInteger(second)) return null;
  if (first !== second) return { key: 'unlike', text: `${first}, then ${second}: never twice alike, as Carew said of the Hurlers, 'a redoubled numbring neuer eueneth with the first'.` };
  if (first === COUNTLESS_N) return { key: 'beaten', text: `${first}, and ${second}: twice alike, and every stone, standing or fallen. Sidney said no eye 'Can count them just'. You have.` };
  return { key: 'alike_wrong', text: `${first}, and ${second}: twice alike, but you have missed some, or counted one twice. Walk round again: every stone, standing or fallen, the low ones too.` };
}

const COUNTLESS_XP = 30;
const COUNTLESS_LORE = "That a stone circle cannot be counted twice alike is old in the record. Sir Philip Sidney, before 1586, said of Stonehenge that 'neither any eye / Can count them just'. Richard Carew, in his Survey of Cornwall (1602), said of the Hurlers that 'a redoubled numbring neuer eueneth with the first', and that the country people held 'once they were men, and for their hurling vpon the Sabboth, so metamorphosed'. Celia Fiennes heard of Stonehenge that 'none Can Count them twice alike', and at Long Meg and her Daughters in 1698 'they affirme they Cannot be Counted twice alike as is the story of Stonidge'. Later tales add a baker: at the Rollright Stones, the King's Men, one counted by 'placing a loaf on each stone' (Folk-Lore, 1902), and at Stanton Drew, English Heritage says, 'It's said that anybody who tries to count the stones will fall ill or even die', a belief 'recorded by John Wood in 1749'.";
// The one modern line, folded under the count (client/now-note.js).
const COUNTLESS_NOTE = "The real stone circles are protected monuments: count them as often as you like, but don't climb on them or take a chip away.";
const COUNTLESS_SOURCE = 'Sir Philip Sidney, "The 7 Wonders of England" (before 1586) · R. Carew, The Survey of Cornwall (1602) · The Journeys of Celia Fiennes (1680s–1698) · "The Rollright Stones", Folk-Lore 13 (1902) · English Heritage, "Stanton Drew Circles and Cove: History" and "Rollright Stones" · Historic England, list entry 1018400, and "Scheduled Monuments: A Guide for Owners and Occupiers"';

module.exports = { COUNTLESS, COUNTLESS_STONES, COUNTLESS_N, countlessVerdict, COUNTLESS_XP, COUNTLESS_LORE, COUNTLESS_NOTE, COUNTLESS_SOURCE };
