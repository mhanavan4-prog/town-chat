// ---------------------------------------------------------------------------
// Horn Fair, Charlton, St Luke's Day, 18 October: the Deptford mob met at
// Cuckold's Point and went to Charlton in horns and women's gowns. The caller
// is dated by the Commonplace Book's own entry (when: { calendar: 'horn_fair' }).
//
// Sources: W. Hone, The Every-Day Book, vol. II (1827), 18 October, read
// first-hand in the Hone archive transcription (quoting Brand, an "old
// newspaper", and the Life of William Fuller, 1703); D. Defoe, A Tour thro'
// the Whole Island of Great Britain (1724–27), Letter II, read first-hand in
// Vision of Britain; D. Lysons, The Environs of London, vol. 4 (1796),
// "Charlton", read first-hand in British History Online (quoting Philipott,
// 1659); the Fairs Act 1871, s. 3; the abolition of 1872 from the Daily News
// (second-hand); the Royal Greenwich Heritage Trust for the fair now. For the
// practical half: NHS, "Alcohol poisoning" and "The risks of drinking too
// much"; St John Ambulance, "Recovery position".
//
// Put right: Hone only conjectured St Luke's ox; "St Luke's little summer" is
// not in Hone, so the old calendar entry now cites The Spectator (1927) for it.
// Left out: the miller's wife in the King John story (only in modern
// accounts; Hone and Lysons dismiss the King John story itself); Defoe's
// "rudest drunken mob" (not his words); the Gazette order of 1872 (not found);
// Chambers on the day (not read); "getting home safely" advice (no official
// page found).
// ---------------------------------------------------------------------------
const HORN_RITES = {
  horn_fair: {
    key: 'horn_fair', name: 'Horn Fair', icon: '📯',
    how: 'On St Luke\'s Day go to Horn Fair at Charlton with horns on your head, as the mob went from Cuckold\'s Point, three times round the church, and bring everyone home again.',
    outcomes: [
      'Gilt rams\' horns on every head, and even the gingerbread has horns. All is fair at Horn Fair.',
      'Three times round Charlton church, a king, a queen and a miller at the front, and the parson looking the other way.',
      'Half the lads are in their sisters\' gowns and masks. Nobody\'s sure who anybody is, and that\'s the point.',
    ],
    lore: 'Philipott wrote in 1659 that Charlton\'s fair was "called Horn-fair, by reason of the great plenty of all sorts of winding horns and cups, and other vessels of horn there brought to be sold", and "kept yearly on St. Luke\'s Day" (Lysons, 1796). Defoe called Charlton "famous, or rather infamous for the yearly collected rabble of mad-people, at Horn-Fair": "The mob indeed at that time take all kinds of liberties, and the women are especially impudent for that day", and he would have it "suppress\'d, as a nusance and offence to all sober people". Brand, as Hone quotes him, saw "a riotous mob, who, after a printed summons dispersed through the adjacent towns, meet at Cuckold\'s point, near Deptford", where "even the ginger-bread figures have horns". An old procession, Hone says, had "a king, a queen, a miller, a counsellor", and "went round the church three times". The proverb "all is fair at Horn Fair" came of "so many indecencies on Blackheath, such as the whipping of females with furze". Men went in women\'s clothes: William Fuller remembered going "dressed in my land-ladie\'s best gown" (1703), and in 1825 "most of the visitors wore masks". The horns, Hone thought, "may be conjectured to have originated from the symbol" of St Luke, painted "with an ox or cow by his side, whose horns are conspicuous". The tale that King John granted the fair after being caught in "an adventure of gallantry" Lysons called "a vague and idle tradition", and Hone "too ridiculous to merit the smallest attention". The procession stopped in 1768; the fair was abolished in 1872 under the Fairs Act, and is kept again at Charlton House.',
    tier: 'record',
    source: 'W. Hone, The Every-Day Book, vol. II (1827), 18 October · D. Defoe, A Tour thro\' the Whole Island of Great Britain (1724–27), Letter II · D. Lysons, The Environs of London, vol. 4 (1796), "Charlton" · Fairs Act 1871, s. 3 · Royal Greenwich Heritage Trust, "Horn Fair 2026"',
  },
};

module.exports = { HORN_RITES };
