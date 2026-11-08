// ---------------------------------------------------------------------------
// Rush-bearing at Ambleside, Westmorland: girls carry bearings of rushes and
// flowers to church behind a band and set them about the pulpit and pews, as
// the rushes once strewed the floor, and get gingerbread at the church door.
// Kept on 26 July in 1823 (a Saturday), on the Saturday before the last Sunday
// in July in 1906, and now on the first Saturday in July. The caller is dated
// by the Commonplace Book's own entry (when: { calendar: 'rushbearing' }).
//
// Sources: The Gentleman's Magazine (1823), pt 2, p. 173, and (1843), pt 2, p.
// 572, as the Lakes Guides transcriptions give them; St Mary at Hill's
// churchwardens' accounts, 1493–4, ed. H. Littlehales (EETS, 1905); K. L.
// Bates, From Gretna Green to Land's End (1907), "Three Rush-Bearings", for
// Ambleside in 1906, Owen Lloyd's hymn, and Hone's Year Book on Grasmere in
// 1827 (second-hand, as Bates gives it); Visit Cumbria; Gilbert White, The
// Natural History of Selborne, Letter XXVI to Barrington (1775), on
// rushlights; the Wildlife and Countryside Act 1981, ss. 1 and 13; the Game &
// Wildlife Conservation Trust and Scotland's Rural Payments on rushes and
// nesting waders; Lancashire Fire & Rescue on candles. Left out: a "Saturday
// nearest St Anne's Day" rule no source gives, the year Lloyd wrote the hymn,
// and when the two churches were flagged.
// ---------------------------------------------------------------------------
const RUSH_RITES = {
  rushbearing: {
    key: 'rushbearing', name: 'The Rush-bearing', icon: '💐',
    how: 'Cut soft rushes, with the landowner\'s leave, and make them into bearings, a cross, a harp or a shepherd\'s crook, wound with flowers; carry them to church behind the band, and set them round the pulpit and the pews; then take your penny-worth of gingerbread at the church door.',
    outcomes: [
      'The girls walk behind the band to church with their bearings. Yours is a harp of rushes threaded with harebells.',
      'The bearings go up round the pulpit and the reading desk, and the old church smells of green rush and summer.',
      'At the church door each child gets a penny-worth of gingerbread and a coin, and runs off with it.',
    ],
    lore: 'At Ambleside "On the 26th and 27th of July" 1823 "the antient custom of Rush-bearing took place": "young girls, to the number of about forty, formed the procession to the Church, preceded by a band of music", and the bearings were set "round the pulpit, reading-desks, pews, &c." (The Gentleman\'s Magazine). The rushes had once been the floor itself; Grasmere\'s church in 1843 "is annually strown with rushes", and at Ambleside "The children receive a penny-worth of gingerbread, and a small gratuity at the door of the church" (The Gentleman\'s Magazine, 1843). Churches had long paid for them: in 1493–4 St Mary at Hill in London "payd for ij burdens of Russhys for þe newe pewys, iij d." At Grasmere in 1827 a walker writing for Hone\'s Year Book saw the Wordsworths in the procession. By 1906 Ambleside\'s bearings were "harps of reeds and waterlilies, crosses of ferns and harebells, shepherds\' crooks wound with heather", and the children sang a hymn written for them by the Rev. Owen Lloyd (K. L. Bates, 1907). Ambleside now keeps it on the first Saturday in July.',
    tier: 'record',
    source: 'The Gentleman\'s Magazine (1823), pt 2, p. 173, and (1843), pt 2, p. 572 · H. Littlehales, ed., The Medieval Records of a London City Church (1905) · K. L. Bates, From Gretna Green to Land\'s End (1907), "Three Rush-Bearings" · Visit Cumbria, "Rushbearing"',
  },
};

module.exports = { RUSH_RITES };
