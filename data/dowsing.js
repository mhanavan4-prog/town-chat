// ---------------------------------------------------------------------------
// Dowsing for a well with a forked hazel twig, and Agricola's own test of it.
//
// The caller brings a forked hazel twig from his hedge. You walk the Wilds
// holding it as the old dowsers did, and now and then it twists down in your
// hands. You dig where it dipped, and once where it did not. Water is found
// at both, a few feet down: the honest point, that "in many areas water would
// be hard to miss" (USGS), and that the twig, tested fairly, does "no better
// than would be expected by chance" (UK Groundwater Forum).
//
// How the game does it, so it cannot pretend: the twig dips at random as you
// walk (the server's dice, standing in for the dowser's own hands), and every
// dig strikes water, at a depth that depends only on where you dig, never on
// whether the twig dipped.
// ---------------------------------------------------------------------------
const DOWSE_DIP_EVERY = [250, 650];   // a dip comes at random, somewhere within this many units walked
const DOWSE_NEAR_DIP = 70;            // a dig this near the last dip is "where it dipped"
const DOWSE_CONTROL_AWAY = 220;       // a control dig must be at least this far from every dip

// Feet down to water at a spot: from where it is only (a fixed hash of the
// spot), 4 to 13 feet, and there is always water.
function dowseDepth(x, y) {
  const gx = Math.round(x / 40), gy = Math.round(y / 40);
  let h = (gx * 73856093) ^ (gy * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return 4 + (Math.abs(h) % 10);
}

const DOWSE_LORE = "Agricola's De Re Metallica (1556) gives what its translators call 'the first published description of the divining rod as applied to minerals or water': 'a forked one cut from a hazel bush', its forks grasped 'with their hands, clenching their fists', 'the clenched fingers… held toward the sky'; and 'It is said that the moment they place their feet on a vein the twig immediately turns and twists'. Agricola himself thought 'the manipulation is the cause of the twig's twisting motion', and that a good miner 'should not make use of an enchanted twig'. The forked twig, the 1911 Britannica says, 'was brought to England by those engaged in the Cornish mines by the merchant venturers of Queen Elizabeth's day', and Baring-Gould found it 'still employed' in Wiltshire 'for the purpose of detecting water'. Tested fairly it does no better than chance: 'when it has been tested impartially it has been no more successful than would be expected by chance' (UK Groundwater Forum). What moves it is the ideomotor effect, 'the involuntary movements of the dowser, which are influenced by the dowser's expectations or beliefs' (Britannica); and 'in many areas water would be hard to miss' (USGS).";
const DOWSE_SOURCE = 'G. Agricola, De Re Metallica (1556), Book II, trans. H. C. and L. H. Hoover (1912), with their note · Encyclopaedia Britannica (1911), "Divining-rod" · S. Baring-Gould, Curious Myths of the Middle Ages · UK Groundwater Forum, "Does divining work?" · USGS, Water Dowsing (1988) · Britannica, "ideomotor effect" · GOV.UK, "Check if you need a licence to abstract water" · British Geological Survey, aquifer designation data and WellMaster · Drinking Water Inspectorate, private water supplies';

module.exports = { DOWSE_DIP_EVERY, DOWSE_NEAR_DIP, DOWSE_CONTROL_AWAY, dowseDepth, DOWSE_LORE, DOWSE_SOURCE };
