// ---------------------------------------------------------------------------
// St Brigid's Eve, 31 January into 1 February (Ireland): the Brídeóg, a
// figure of the saint made on a churn-dash or broom and dressed in white,
// carried from house to house for pennies or eggs; the rushes brought in at
// dusk with "let in Brigid"; and the brat Bríde, a cloth left out overnight
// for the saint to bless, kept against pain. (Brigid's cross is the Imbolc
// rite.) The caller is dated by the Commonplace Book's own entry (when: {
// calendar: 'brigid_eve' }).
//
// Sources: Journal of the County Kildare Archaeological Society, vol. I
// (1891–95), on the Kerry "Breedoge"; the Leinster Leader (2 February 1907),
// on Lord Walter Fitzgerald's paper; the National Folklore Collection's
// Schools' Collection (1937–39), as dúchas.ie gives it (Ballinderry, Co.
// Galway; Tully Beg, Co. Donegal; Ballyduff, Co. Waterford); the National
// Museum of Ireland (C. Doyle); Discover Kerry on the Biddy Boys; gov.ie on
// the public holiday; the HSE on sore throats. Left out: "west Limerick" for
// the Biddy Boys, and the Irish door verse in a form no source here gives.
// ---------------------------------------------------------------------------
const BRIGID_RITES = {
  brideog: {
    key: 'brideog', name: 'The Brídeóg', icon: '🌾',
    how: 'Dress a churn-dash in a white dress with straw for arms, and carry the Brídeóg from house to house on St Brigid\'s Eve for pennies or eggs; bring the rushes in at dusk with "let in Brigid"; and leave a strip of cloth on the windowsill for the saint to bless as she passes.',
    outcomes: [
      '"Here is St Bridget dressed in white!" The woman of the house gives two eggs and a penny for the Brídeóg.',
      'Three times round the house with the rushes: "Go on your knees and let in Brigid." From within: "She is welcome."',
      'At dawn the strip of cloth on the sill is wet with dew. It goes in the dresser drawer for the headaches of the year.',
    ],
    lore: 'In Kerry in the 1890s the Brídeóg "consists of a churn-dash, or broomstick, padded round with straw", "covered with a woman\'s dress", and boys and girls carried it "from house to house on St Bridget\'s Eve", and were "given pennies, or more generally eggs" (Journal of the County Kildare Archaeological Society). In Kildare collections of food and money were made "in honour of Miss Biddy" (1907). Children in Galway in the 1930s sang "Here is St Bridget dressed in white, Give her a penny in honour of the night"; in Donegal the rushes for the crosses were carried three times round the house, and at the door: "Go on your knees and let in Brigid", answered from within, "she is welcome" (Schools\' Collection). "The \'Brat Bríde\' (Brigid\'s Mantle) was a piece of cloth left outside the dwelling-house on the eve of St Brigid\'s Day. It was believed that the cloth was a cure for various pains and headaches and a protection against dangers such as drowning." In Kerry the Biddy Boys still go round, "masked men and women dressed in white uniforms, sashes and wearing elaborate oaten-straw hats". Since 2023 Ireland has kept a public holiday for her, its first named for a woman.',
    tier: 'folk',
    source: 'Journal of the County Kildare Archaeological Society, vol. I (1891–95) · Leinster Leader (2 February 1907) · National Folklore Collection, Schools\' Collection (1937–39), via dúchas.ie · Dúchas, "1 February – St Brigid\'s Day" · Discover Kerry, "Biddy\'s Festival"',
  },
};

module.exports = { BRIGID_RITES };
