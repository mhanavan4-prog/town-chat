// The Forbidden Shelf (roadmap #6 — a reason to return to the Midnight Archive).
// A date-seeded "book of the day" sits on the locked case in the Library; a
// different one surfaces each day. Reading it logs the title to the player's
// Forbidden Archive codex (account-wide) — read all of them to earn the
// "Reader of the Forbidden Shelf" title. Pure authored lore (no AI, no
// sanitizer): these passages deepen the world's existing threads — the Seal and
// the Fifth Severance, the Hollow, the Keeper below, the Two Watches, the Widow,
// the Ember Road — so the daily read doubles as the lore codex that seeds #8.
//
// Keep each `text` a few sentences, ominous and oblique. Order is cosmetic; the
// rotation is `day % FORBIDDEN_BOOKS.length`, so adding books lengthens the
// cycle without disturbing anyone's logged reads (keyed by `id`, never index).

const FORBIDDEN_BOOKS = [
  {
    id: 'correspondence_drowned',
    title: 'Correspondence With the Drowned',
    author: 'compiled by an unnamed archivist',
    text: 'A ledger of letters sent down to the flooded dark and the replies that came back up, salt-stained and in a hand nobody living could own. The drowned answer every question but the one you most want asked, and they charge for the postage in memory. The last entry is blank but for a wet thumbprint — the archivist posted one letter too many.'
  },
  {
    id: 'the_unblinking',
    title: 'The Unblinking',
    author: 'do not read aloud · shelf 13',
    text: 'It is not a god and it is not a door; it is the attention behind both. The book insists the Unblinking has watched Thornreach since before the first witch drew breath, and that being seen by it is neither blessing nor curse but simply permanent. Readers report the sensation of a gaze at the back of the neck for a week after. The sensation is correct.'
  },
  {
    id: 'phases_of_her',
    title: 'Phases of Her',
    author: 'as above, so below',
    text: 'The moon is described here not as a stone in the sky but as a face turning slowly away from us and, on the blood nights, turning back. Each phase is a mood, and each mood is owed a different offering. The waning crescent wants salt; the full wants a secret; the new moon wants nothing, which is the most frightening thing it could ask for.'
  },
  {
    id: 'fifth_severance',
    title: 'On the Fifth Severance',
    author: 'a Thornwarden hand, recanted',
    text: 'Five witches raised the Seal that keeps the Hollow shut, and four are buried where their oaths can still watch the stone. This book is the only account of what the fifth hand has been doing in the long quiet since — and every copy but this one was burned by people who read it first. The final chapter is missing. The table of contents still lists it.'
  },
  {
    id: 'the_hollow_beneath',
    title: 'The Hollow Beneath Every Field',
    author: 'transcribed from a hum',
    text: 'Beneath every quiet pasture in Thornreach there is a door, and behind every door the Hollow keeps its patience. The author claims to have mapped the doors by walking barefoot until the ground hummed back, and the map is folded into the spine. Do not unfold it indoors. The hum is not a warning that something is coming; it is the sound of something listening to you decide.'
  },
  {
    id: 'keeper_below',
    title: 'The Keeper Below the Rocks',
    author: 'left as an offering, unsigned',
    text: 'Five hundred years the witch beneath the cave has kept her cauldron lit, and this book is the etiquette of visiting her: bring herbs, bring honest words, leave your hungers at the cave mouth. She knows your name before you give it and will not use it, which is a courtesy you should return. The recipe on the last page is hers. It is not for food.'
  },
  {
    id: 'two_watches',
    title: 'The Two Watches, Reconciled',
    author: 'an optimist, later missing',
    text: 'The Unbound would crack the Seal to mend it true; the Thornwardens would brace the crack and pray. This slim volume is the only known attempt to argue both are right, which is presumably why its author is the subject of a waymarker and not a signature. Someone has written a single word in the margin of every page. Read top to bottom, the words are an apology.'
  },
  {
    id: 'widow_vigil',
    title: 'The Widow Keeps the Watch',
    author: 'collected from Parlor regulars',
    text: 'Testimony after testimony about the terrace that was torn down and the step that never stopped — heel, toe, heel — pacing the spot where the rail used to be. The compiler sets out to prove the Widow a story and ends, three chapters in, addressing her directly. She is still watching the road. The book asks that you look up now and then. It is only polite.'
  },
  {
    id: 'ember_road',
    title: 'Baedeker of the Ember Road',
    author: 'for the paying traveller',
    text: 'A traveller\'s guide to the door of embers that opens over the Temple altar when all four torches burn, and the ash flats beyond it where the coin is good and the dying is easy. It rates the Wastes three skulls for scenery and five for regret. The author recommends finishing your supper before you go, and names no return route, because there is only the one, and it does not always wait.'
  },
  {
    id: 'ledger_of_debts',
    title: 'A Ledger of Small Debts',
    author: 'balance carried forward',
    text: 'Every bargain struck at a crossroads in Thornreach is said to be written here in a column that never closes. The debts are modest — a night\'s sleep, the taste of your mother\'s name, the colour blue — and that is the trap of them. The book has a page with your handwriting on it. You do not remember signing, which is exactly the point of the first debt.'
  },
  {
    id: 'grammar_of_crows',
    title: 'A Grammar of Crows',
    author: 'field notes, incomplete',
    text: 'The author spent forty years proving that the crows over the treeline are not speaking to each other but reading aloud, and that what they read is us. Conjugation is by omen; the pluperfect tense can only describe a death that has not happened yet. The grammar is sound. The last lesson is a single sentence you are advised not to learn to say.'
  },
  {
    id: 'house_that_remembers',
    title: 'The House That Remembers Its Dead',
    author: 'a surveyor of the Manor',
    text: 'Concerning the private world behind the Hagstone and the long hall where a coven\'s beds are kept: the book argues the Manor does not store the departed so much as decline to forget them. Rooms rearrange toward the ones who are gone. Claim a bed, the surveyor warns, and the house will one day keep your chair at the angle you liked, long after you have stopped needing a chair.'
  },
  {
    id: 'inventory_of_the_veil',
    title: 'An Inventory of the Veil',
    author: 'séance minutes, redacted',
    text: 'Someone attempted to catalogue everything the board has ever spelled, sorted not by question but by how true the answer turned out to be. The "true" column is the longest and the most heavily struck through. Between the lines, a pattern: the veil lies most about the future and least about the reader. The final page is a mirror, which is the book\'s only honest answer.'
  },
  {
    id: 'almanac_of_sabbats',
    title: 'An Almanac of Stolen Sabbats',
    author: 'kept against the calendar',
    text: 'A reckoning of the eight sabbats and the one that was taken off the wheel so thoroughly that only its absence remains, a gap between two festivals where the year holds its breath. The almanac counts down to it on a page that updates itself in ink that is always just drying. No one who has read to the final date has said what they found there. The date is close. It is always close.'
  }
];

module.exports = { FORBIDDEN_BOOKS };
