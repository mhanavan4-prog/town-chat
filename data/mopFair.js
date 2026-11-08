// ---------------------------------------------------------------------------
// The mop, or statute fair, at Old Michaelmas (11 October in Hone's day): farm
// servants stood in the street with the sign of their trade in their hats to
// be hired for the year, took the master's earnest shilling, and changed the
// sign for ribbons. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'mop_fair' }).
//
// Sources: the Statute of Artificers, 5 Eliz. c. 4 (1563), s. II, in the
// Statutes of the Realm; W. Pare, "'Statutes' and 'Mops'", in W. Hone, The
// Table Book, vol. I (1827), cols. 171–78, with Plot (1677) as Hone gives it;
// W. Howitt, The Rural Life of England, 2nd edn (1840), pp. 495–97; Hone, The
// Every-Day Book (1826–27), 11 October, for Old Michaelmas Day; R. Jefferies,
// letter to The Times (1872), in Toilers of the Field; Warwick District and
// Stratford-on-Avon District Councils on the mops now; gov.uk on written
// terms, holiday and the minimum wage for farm workers; the Gangmasters and
// Labour Abuse Authority and the Modern Slavery & Exploitation Helpline. Left
// out: a maid's mop as her sign (no period witness has one; Pare's girls stood
// without any), Hardy's Casterbridge fair (it is in February), "God's penny",
// and Brand and Simpson & Roud, which couldn't be read.
// ---------------------------------------------------------------------------
const MOP_RITES = {
  mop_fair: {
    key: 'mop_fair', name: 'Standing at the Mop', icon: '🎀',
    how: 'At the mop on Old Michaelmas put the sign of your trade in your hat, whipcord for a carter, wool for a shepherd, cow-hair for a cowman, a bit of sponge for a groom, and stand in the street with the others; when a master hires you for the year, take his earnest shilling and change the sign for ribbons.',
    outcomes: [
      'Whipcord round your hat, you stand in the street with the other carters. The farmers walk slow along the line.',
      'A farmer asks your last place and your wage, and puts a shilling in your hand: the earnest. Hired for the year.',
      'The whipcord comes out of the hat and ribbons go in, every colour. Tonight the fair, and Monday the new place.',
    ],
    lore: 'The yearly hiring was the law before it was a custom: the Statute of Artificers (1563) allowed no servant in husbandry to be hired "for any lesse tyme or terme then for one hole yere", and the fairs kept the name of the statute sessions where the wages had once been set. In Warwickshire, Pare wrote in 1827, "a waggoner, or ploughboy, had a piece of whipcord in his hat… a cow-man… had some cow-hair… a piece of sponge; a shepherd had wool; a gardener had flowers", while the girls "stood not unlike cattle at a fair waiting for dealers". The bargain was sealed with "\'earnest money,\' which is usually one shilling", and "When the hiring is over, the emblems in the hats are exchanged for ribbons of almost every hue." Howitt (1840) knew the earnest as "the Fastening-penny, from its formerly being a penny, though now a shilling", and saw farmers "cheapening them much as they would cheapen a horse". A servant who had found a bad master could try again at the Runaway Mops a week or two later. In Warwickshire and Oxfordshire "these statutes are held about Old Michaelmas-day", which Hone kept on 11 October; Warwick and Stratford still hold their mops, as funfairs, about the 12th. Jefferies (1872) wrote that "Many an honest, hard-working servant-girl owes her ruin to these fatal mops and fairs."',
    tier: 'record',
    source: 'Statute of Artificers, 5 Eliz. c. 4 (1563), s. II · W. Pare, "\'Statutes\' and \'Mops\'", in W. Hone, The Table Book, vol. I (1827), cols. 171–78 · W. Howitt, The Rural Life of England (1840), pp. 495–97 · R. Jefferies, Toilers of the Field (1892) · Warwick District Council, "The Mop"',
  },
};

module.exports = { MOP_RITES };
