// ---------------------------------------------------------------------------
// The Mari Lwyd: in south Wales from Christmas to Twelfth Night (and Hen
// Galan), a party carried a horse's skull dressed with ribbons and a white
// sheet from house to house, and challenged each household to the pwnco, a
// contest of improvised verses at the door, before they were let in to eat
// and drink. A Yule caller (the Yule season only).
//
// Sources: Amgueddfa Cymru – Museum Wales, "Christmas traditions" (2014), the
// folk song "Can y Fari Lwyd" (St Fagans, 1953) and the skull 49.347
// (Cowbridge); the Horniman Museum, "The mystery of Mari Lwyd" (2022); Trac
// Cymru on the Mari Lwyd; J. Evans, A Tour Through Part of North Wales, in the
// Year 1798 (1800), the first account, as the museums give it. The name is
// most likely "Grey Mare"; "Holy Mary" was once proposed and is told as such.
// No pwnco verse is quoted, as none could be checked against its source.
// ---------------------------------------------------------------------------
const MARI_RITES = {
  pwnco: {
    key: 'pwnco', name: 'The Mari Lwyd', icon: '🐴',
    how: 'When the Mari Lwyd comes, bar the door and answer her party\'s verses with verses of your own, rhyme for rhyme, until one side runs dry; then open the door, let the Mari in, and feed the party.',
    outcomes: [
      'A verse through the keyhole, and you answer it. Another, and another. At the sixth you run dry, and in comes the Mari.',
      'The skull snaps its jaws at the children, who shriek and hide and come straight back for more.',
      'You win the pwnco with a rhyme on the leader\'s boots. He bows, and you let them in all the same, as you always do.',
    ],
    lore: 'The Mari Lwyd was "a real horse\'s skull, usually decorated with coloured ribbons and rosettes", on a pole; "A long white cloth is draped down the carrier which hides him from view" (Museum Wales). She went the rounds from Christmas Day "through to Twelfth Night and Hen Galan", and was "especially popular in Glamorgan, Monmouthshire and Carmarthenshire". At each door came the pwnco, "an improvised rhyme and verse contest between the Mari party and the inhabitants of the house", which could last an hour, before the party was let in. The first account is of 1798, in Evans\'s Tour Through Part of North Wales (1800). The name most likely means "Grey Mare"; the folklorist Iorwerth Peate once thought it "Holy Mary". Of all the horse customs of Britain, the Hooden Horse of Kent and the Obby Oss of Padstow among them, "only the Mari Lwyd has a poetry competition at its heart" (Trac Cymru). Llangynwyd has kept it longest, and it is kept again across south Wales.',
    tier: 'record',
    source: 'Amgueddfa Cymru – Museum Wales, "Christmas traditions" (2014) · Horniman Museum, "The mystery of Mari Lwyd" (2022) · Trac Cymru, "The Mari Lwyd" · J. Evans, A Tour Through Part of North Wales, in the Year 1798 (1800)',
  },
};

module.exports = { MARI_RITES };
