// ---------------------------------------------------------------------------
// Saining the house at the New Year, as W. Grant Stewart saw it done in
// Strathdown, on the Avon in Banffshire: water from "the dead and living ford"
// carried home in silence, the household sprinkled, the house stopped up to the
// key-hole and filled with juniper smoke until everyone coughed, then the vent
// thrown open, the beasts done the same, and a cordial from the bottle dhu.
// "Sain": to keep evil away by a sign or a rite (Scottish National Dictionary).
// The caller is dated by the Commonplace Book's own entry (when: { calendar:
// 'hogmanay_saining' }).
//
// Sources, read in full: W. Grant Stewart, The Popular Superstitions and
// Festive Amusements of the Highlanders of Scotland (1823; ed. of 1851),
// "New-Year's Eve", pp. 172–177, with his note that it was "now administered
// in no part of the Highlands, except in Strathdown"; J. G. Campbell,
// Witchcraft & Second Sight in the Highlands & Islands (1902), pp. 11, 241–2
// (New Year's Day "a great saining day", juniper "burnt in the byre"); the
// Scottish National Dictionary, "Sain".
//
// Left out: that the household drank the ford water (Stewart has it sprinkled),
// whisky by name (Stewart says "the bottle dhu"), the gloss of the ford as one
// "the living and the dead" cross (not Stewart's; McNeill's own wording we
// could not read), and the tale that the juniper rite ended when a girl was
// suffocated (Polson, 1932, not seen). Modern "saining as smudging" is left
// to the modern revival it belongs to.
// ---------------------------------------------------------------------------
const SAINING_RITES = {
  saining: {
    key: 'saining', name: 'Saining the House', icon: '🌿',
    how: 'Fetch water from the dead and living ford in silence, and never let the pitcher touch the ground. Sprinkle the beds and everyone in them. Stop every crevice, to the key-hole, kindle the juniper and let it smoke until the house coughs; then open the vent. Do the same for the beasts. A cordial from the bottle dhu to finish.',
    outcomes: [
      'Not a word on the way back from the ford, and the pitcher never touches the ground. The brush goes round the beds and the sleepers wake spluttering. Then the juniper, and the whole house sneezes in the New Year.',
      'The smoke is so thick that the old man hiccups through the first blessing of the year. Open goes the vent, out goes the smoke, and the gudewife brings out the bottle dhu.',
      'The byre next: the cows stamp and blow at the juniper, and the old horse sneezes twice. Whatever was waiting for the New Year will have to wait somewhere else.',
    ],
    lore: 'In Strathdown at the New Year, W. Grant Stewart wrote, the juniper bushes were "as much in request this night as kail is on Hallowe\'en". Someone went to "the dead and living ford" for water, "observing all the time the most profound silence", and the vessel must not touch the ground. In the morning the household was sprinkled with it "by means of a large brush"; then they would "stuff all the crevices and windows in the house, even to the key-hole", and "piles of juniper are kindled into a conflagration", until "an incessant shower of hiccupping, sneezing, wheezing, and coughing"; then the vent was opened, and "the horses, cattle, and other bestial stock" were done too, and the gudewife gave a "renovating cordial" from the "bottle dhu". He says it was then done nowhere else in the Highlands. In the Highlands and Islands, J. G. Campbell wrote, New Year\'s Day was "a great saining day": juniper was "burnt in the byre", and the animals marked with tar.',
    tier: 'record',
    source: 'W. Grant Stewart, The Popular Superstitions and Festive Amusements of the Highlanders of Scotland (1823; ed. of 1851), "New-Year\'s Eve", pp. 172–177 · J. G. Campbell, Witchcraft & Second Sight in the Highlands & Islands of Scotland (1902), pp. 11, 241–2 · Scottish National Dictionary, "Sain"',
  },
};

module.exports = { SAINING_RITES };
