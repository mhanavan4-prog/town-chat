// ---------------------------------------------------------------------------
// Helston Furry Day, 8 May (or the Saturday before, when the 8th is a Sunday
// or Monday): the town goes out early to bring home "the Summer and the May,
// O!", dances the Furry through the streets, and makes anyone caught at work
// leap the river. The caller is dated by the Commonplace Book's own entry
// (when: { calendar: 'helston_furry' }).
//
// Sources: "Durgan", The Gentleman's Magazine 60, pt 1 (1790), p. 520, as
// T. S. Knowlson (1910) and the Library of Congress folklife blog (2022) quote
// it (Bell, 1857, p. 167, gives a shortened, bracketed text);
// W. Hone, The Every-Day Book, vol. II (1827), 8 May, col. 648; D. Gilbert,
// Parochial History of Cornwall (1838), on the name; S. Baring-Gould and the
// Library of Congress Folklife blog on the song's first printing (1802);
// Helston Flora Day Association on the date; the RHS on lily of the valley;
// the NHS and the Met Office on heat. Left out: the 1790 letter as the source
// of "fade into" (that is Hone's correspondent, 1827) or of "hal-an-tow" (not
// in it), and the dances' modern timetable and dress.
// ---------------------------------------------------------------------------
const FURRY_RITES = {
  furry_day: {
    key: 'furry_day', name: 'The Furry', icon: '💃',
    how: 'On Furry Day go out early with the drums to bring home "the Summer and the May, O!"; fade into the country for flowers and oak boughs and come back with them in your hat; dance the Furry through the streets, in at one door and out at the next; and make anyone caught at work leap the river, or pay.',
    outcomes: [
      'At seven the big drum strikes, and the town goes dancing down the street behind the band, two by two.',
      'In at the front door of a house and out at the back, through the garden and on down the street. Nobody minds.',
      'A man caught mending his cart is carried to the river and made to leap. He lands short, and the whole street cheers.',
    ],
    lore: 'The first clear account is a letter signed Durgan in The Gentleman\'s Magazine for 1790: "At Helstone, a genteel and populous borough town in Cornwall", the day "is called the Furry Day, supposed Flora\'s Day", though the writer thought the name came "rather from the garlands commonly worn on that day". Early in the morning "some troublesome rogues go round the streets with drums, or other noisy instruments", singing a song "of which I know no more than that there is mention in it of the \'grey goose quill,\' and of going \'to the green wood\' to bring home \'the Summer and the May, O!\'" Hone\'s correspondent (1827) adds that anyone "found at work" was "set astride on a pole, and hurried on men\'s shoulders to the river, where he is sentenced to leap over a wide place", and that the people "fade into the country, (fade being an old English word for go,) and, about the middle of the day, return with flowers and oak branches in their hats and caps." The name, "supposed by Mr. Polwhele to have been derived from the old Cornish word fer, a fair or jubilee", is most likely Cornish; Flora is a learned guess, which Gilbert in 1838 called an "utter absurdity". The Hal-an-Tow\'s words, with Robin Hood, the Spaniards and St George, were printed from 1802 on; its pageant is a revival of the 1930s, and the lily of the valley worn today is modern custom.',
    tier: 'record',
    source: '"Durgan", The Gentleman\'s Magazine 60 (1790), p. 520, as quoted in T. S. Knowlson, The Origins of Popular Superstitions and Customs (1910) · W. Hone, The Every-Day Book, vol. II (1827), 8 May, col. 648 · D. Gilbert, Parochial History of Cornwall (1838)',
  },
};

module.exports = { FURRY_RITES };
