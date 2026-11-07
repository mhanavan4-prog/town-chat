// ---------------------------------------------------------------------------
// Oak Apple Day, 29 May: the King's birthday and the Restoration, kept by Act
// of Parliament from 1660 to 1859. Everyone wore oak for the oak at Boscobel
// that hid Charles II in 1651; a boy without was stung with nettles
// (Derbyshire) or pelted with eggs (East Yorkshire). The caller is dated by
// the Commonplace Book's own entry (when: { calendar: 'oak_apple_day' }).
//
// Sources: the Act of 1660 (Statutes of the Realm, vol. 5, p. 237); the Act of
// 1859 repealing it; English Heritage on Boscobel; W. Hone, The Every-Day
// Book (1826–27), 29 May; R. Chambers, The Book of Days (1864), 29 May; W.
// Andrews, Old Church Lore (1891), quoting J. Nicholson, Folk Lore of East
// Yorkshire (1890); S. Pepys, Diary, 29 May 1662; the Wiltshire and Swindon
// History Centre (Great Wishford); the Royal Hospital Chelsea. Left out:
// "pinching" and "Oak and Nettle Day", found in no old source here; and any
// oak in Pepys's entries, which have none.
// ---------------------------------------------------------------------------
const OAK_RITES = {
  royal_oak: {
    key: 'royal_oak', name: 'The Oak Sprig', icon: '🌳',
    how: 'Cut green oak boughs at dawn for every door and a sprig, with an oak apple if you can find one, for every hat in the house; and see that nobody is nettled for going without.',
    outcomes: [
      'Oak over every door in the lane by breakfast, and a sprig in the carter\'s hat and his horse\'s bridle too.',
      'You find an oak apple, a little brown gall, and give it to the smallest boy, who wears it all day like a medal.',
      'The big lads have a fistful of nettles for anyone without oak. You hand round sprigs till there\'s nobody left to sting.',
    ],
    lore: 'An Act of 1660 ordered "a Perpetuall Anniversary Thanksgiveing on the nine and twentyeth day of May", the King\'s "most memorable Birth day" and the day his return was "compleated"; it was repealed in 1859. The oak is Boscobel\'s, in Shropshire: after his defeat at Worcester on 3 September 1651, Charles II hid in an oak there with Major William Careless, and a descendant of the Royal Oak still grows by the house (English Heritage). "It is usual with the vulgar people to wear oak-leaves in their hats on this day, and dress their horses\' heads with them" (Hone, 1826), and "A spray of oak in the hat was the badge of a loyalist" (Chambers, 1864). In Derbyshire, "If the lads neglect to wear the oak-leaf they are stung with nettles by their more loyal companions"; in East Yorkshire boys laid up eggs for "Royal Oak Day, or Mobbing Day", and only a boy with "a sprig of Royal Oak, not dog oak" was safe (Andrews, 1891, quoting Nicholson). Pepys in 1662: "This day, being the King\'s birth-day, was very solemnly observed." At Great Wishford in Wiltshire the village still goes to Grovely Wood for boughs on 29 May, crying "Grovely, Grovely, Grovely and all Grovely", and the Chelsea Pensioners wear oak leaves on Founder\'s Day.',
    tier: 'record',
    source: 'Act of 1660, Statutes of the Realm, vol. 5 (1819), p. 237 · English Heritage, "Boscobel House and the Royal Oak" · W. Hone, The Every-Day Book (1826–27), 29 May · R. Chambers, The Book of Days (1864), 29 May · W. Andrews, Old Church Lore (1891), p. 179 · S. Pepys, Diary, 29 May 1662 · Wiltshire and Swindon History Centre, "Oak Apple Day"',
  },
};

module.exports = { OAK_RITES };
