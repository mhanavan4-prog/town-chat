// ---------------------------------------------------------------------------
// St George's Day, 23 April: the Norwich Gild of St George chose its George,
// and its dragon, Snap, outlived the saint. The caller is dated by the
// Commonplace Book's own entry (when: { calendar: 'st_george' }).
//
// Sources: R. Chambers, The Book of Days (1864), 23 April, "Dragon Legends",
// read first-hand online (no page number); C. Mackie, Norfolk Annals, vol. I
// (1901), read in the Project Gutenberg text, for 1811, 1825 and 16 June 1835;
// the Norfolk Record Office, "Outliving St George" (23 April 2026, from Frank
// Meeres), for 1385, the charter of 1417, the riding from 1420 and the 1552
// order (second-hand but archival); the Gild's ordinances as S. Alsford
// translates them from M. Grace, ed., Records of the Gild of St George in
// Norwich 1389–1547 (Norfolk Record Society 9, 1937) (second-hand); Norfolk
// Museums on the surviving snapdragons. For the practical half: NHS, "Heat
// exhaustion and heatstroke"; HSE, "Manual handling at work: good handling
// technique"; RBKC, "How to be safe at Carnival".
//
// Put right: Snap did not walk on St George's Day in Chambers's account. He
// went out "on the Tuesday preceding the eve of St. John the Baptist", the
// June Guild Day, and the old calendar entry now says so. Left out: the
// "Margaret", a dragon of 1408, the Gild's end in 1731, Snap with the
// Whifflers into the 1850s, and Snap collecting pennies (only on blogs); red
// roses (in neither Chambers nor Hone); mumming plays (not checked for this
// day); a phone number on a wristband (no UK authority found).
// ---------------------------------------------------------------------------
const GEORGE_RITES = {
  st_george: {
    key: 'st_george', name: 'The George and the Dragon', icon: '🐉',
    how: 'On St George\'s Day wear a blue coat for the saint, as the gentlemen did, and help the guild choose its George; then bring the dragon down from the loft and make it sound for Guild Day in June.',
    outcomes: [
      'The dragon comes down from the loft, green and gold, its jaws still snapping. No hat in the yard is safe.',
      'The guild chooses its George, and a blue coat is worn for the saint, as the gentlemen wore them in 1614.',
      'Ned tries the frame on in the yard. With the straps let out it sits close, and he can see where he\'s going.',
    ],
    lore: 'The Gild of St George was founded in Norwich in 1385, with a royal charter in 1417; its ordinances bade the brethren "honour as holy St. George\'s day" and choose "their George", and from at least 1420 "a rider dressed as George fought a man in dragon garb" (Norfolk Record Office). In 1552 the saint was put down, "but for pastime, the Dragon to come and show himself in other years". That dragon was Snap, "a magnificent reptile, all glittering in green and gold", and by Chambers\'s telling his day was not this one: he "annually went in procession with the mayor and corporation on the Tuesday preceding the eve of St. John the Baptist", the June Guild Day when the new mayor was sworn, "Guarded by four whifflers, armed with drawn swords". In 1811 "old Snap displayed his glittering wings and gilt tail, and cleared the way for the civic procession to the Cathedral", and on 16 June 1835 "Guild Day was celebrated in Norwich for the last time… \'Snap,\' too, made his final appearance" (Norfolk Annals), swept away by the Municipal Corporations Act. Afterwards the crowd "have more than once attempted to get up a mock Snap", soon dispersed by "a blue-coated policeman". On the day itself, Chambers says, "So late as 1614, it was the custom for fashionable gentlemen to wear blue coats on St. George\'s day." Snapdragons survive in the Norfolk Museums\' collections, and the story goes that their jaws snatched hats from the crowd. The red rose is in neither Chambers nor Hone.',
    tier: 'record',
    source: 'R. Chambers, The Book of Days (1864), 23 April · C. Mackie, Norfolk Annals, vol. I (1901) · Norfolk Record Office, "Outliving St George" (2026) · Records of the Gild of St George in Norwich 1389–1547, ed. M. Grace (1937), trans. S. Alsford · Norfolk Museums',
  },
};

module.exports = { GEORGE_RITES };
