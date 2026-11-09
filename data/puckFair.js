// ---------------------------------------------------------------------------
// Puck Fair, Killorglin, Co. Kerry, 10–12 August: a wild goat brought down
// from the mountain, crowned King Puck by a schoolgirl of the town, the Queen
// of Puck, raised over the square at the Gathering and brought down at the
// Scattering. The caller is dated by the Commonplace Book's own entry (when:
// { calendar: 'puck_fair' }).
//
// Sources: the royal patent of 1613 to Jenkin Conway, as M. Neligan quotes it
// (Irish Times, 2004) and S. Moraghan, Puck Fair: A History (2013), gives it
// (second-hand: the patent roll couldn't be read, and the sources differ on
// the days); S. Lewis, A Topographical Dictionary of Ireland (1837),
// "Killorglin", in transcription; puckfair.ie on the 1840s reports, the
// Cromwell and 1808 tales; S. Lehane (Irish Farmers Journal, 2025) on the
// days; the Irish Times, RTÉ, Radio Kerry and the Irish Examiner on the goat
// since 2022; the Animal Health and Welfare Act 2013, ss. 11–12; the Old
// Irish Goat Society on wild goats. Left out: the patent's own words and
// day count, M. MacNeill on Puck Fair (couldn't be read), the official site's
// "10 day" calendar shift (it was 11), and "Puck's Fair Day" as the second
// day's name.
// ---------------------------------------------------------------------------
const PUCK_RITES = {
  puck_fair: {
    key: 'puck_fair', name: 'King Puck', icon: '🐐',
    how: 'At the Gathering on 10 August bring the wild goat down from the mountain, see him crowned King Puck by the Queen, a schoolgirl of the town, and raised over the square; at the Scattering on the 12th bring him down again, and see him safe back to the mountain.',
    outcomes: [
      'The goat comes down from the mountain in a cart, all beard and horns and temper. The whole town turns out to see him.',
      'The Queen of Puck sets the crown between his horns, and up he goes over the square, looking down on everyone.',
      'At the Scattering he comes down, and back to the mountain he goes, glad to be shut of the lot of them.',
    ],
    lore: 'Puck Fair is older as a fair than as a goat. It is said to rest on a patent of 1613 to Jenkin Conway the younger for a "fair on Lammas day and 2 days after" at Killorglin (as the fair\'s own history gives it), and the Lammas fair moved into the middle of August when the calendar changed. The first sure word of the goat is in Lewis\'s Topographical Dictionary (1837): "the former is called Puck Fair, at which unbroken Kerry ponies, goats, &c., are sold, and a male goat is sometimes ornamented and paraded about the fair." Regular reports of his crowning begin in the 1840s. The tales of why are told late: that a goat warned the town of Cromwell\'s men, or that in 1808 the young Daniel O\'Connell found a ban on fair tolls said nothing about goats. Some see a survival of Lughnasa in it, but that is a theory, not a record. The three days are the Gathering, the fair day and the Scattering, and a schoolgirl of the town, the Queen of Puck, crowns him. Since 2023, after complaints in the heat of 2022, he goes up on the stand for only a short while at the start and the end, with a vet watching over him.',
    tier: 'folk',
    source: 'S. Lewis, A Topographical Dictionary of Ireland (1837), "Killorglin" · S. Moraghan, Puck Fair: A History (2013) · Puck Fair, "History" (puckfair.ie) · Radio Kerry (17 July 2023)',
  },
};

module.exports = { PUCK_RITES };
