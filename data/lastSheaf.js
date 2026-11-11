// ---------------------------------------------------------------------------
// The last sheaf, kept in the house.
//
// All over Britain the last handful of corn cut at harvest was not threshed
// with the rest. It was plaited or dressed, carried home, and kept: hung from
// a beam in the kitchen, set on the dresser, hung up in the farmhouse. What
// became of it then differed by place: kept till the next harvest's took its
// place, or given to the beasts at Christmas, or a tuft of it to the horses on
// the first day of ploughing.
//
// Here you plait one of three forms that the nineteenth-century collectors
// wrote down, each with only the endings recorded for it, at your own cottage
// in the harvest seasons. While it hangs it counts as a ward (Campbell's
// Highlanders hung the Maiden up to keep the fairies out); when its time comes
// you give it away as the record has it, and plait the next at harvest.
//
// Quotations are from the printed books, read in full: Hunt (1903 ed.),
// Courtney (1890), Henderson (1879), Campbell (1900). Gregor's Aberdeenshire
// and the Kilmartin account are read in Frazer (1912), who quotes them; the
// game says so where it uses them.
// ---------------------------------------------------------------------------

// When the corn is cut: plaiting is done at harvest, and only then.
const SHEAF_PLAIT_SEASONS = ['lughnasadh', 'mabon'];
const SHEAF_SEASON_NAMES = { lughnasadh: 'Lughnasadh', mabon: 'Mabon', yule: 'Yule', imbolc: 'Imbolc', ostara: 'Ostara' };

// How a kept sheaf's year ends.
const SHEAF_ENDS = {
  harvest: {
    label: 'Keep it till the next harvest',
    promise: 'It stays there till the next harvest.',
    when: SHEAF_PLAIT_SEASONS, // taken down when the new one goes up
    act: null,
  },
  yule: {
    label: 'At Christmas, give it to the beasts',
    promise: 'At Christmas it goes to the beasts.',
    when: ['yule'],
    act: 'Give it to the beasts',
  },
  plough: {
    label: 'On the first day of ploughing, a tuft to the horses',
    promise: 'On the first day of ploughing, the horses have a tuft of it.',
    when: ['imbolc', 'ostara'],
    act: 'Take a tuft to the horses',
  },
};

// The three forms, each with the endings its sources give it and where it was
// kept. `ends` maps an ending to the line that records it there.
const SHEAF_FORMS = {
  neck: {
    name: 'The Neck',
    short: 'neck',
    icon: '🌾',
    country: 'Devon and Cornwall',
    how: 'Pick out the best ears, plait them into a little sheaf, hold it up and cry the neck. Then hang it from a beam in the kitchen.',
    hangs: 'from a beam in the kitchen',
    put: 'hang it from a beam in the kitchen',
    ends: {
      harvest: 'West Cornwall: "hung up to a beam in the kitchen, where it is left until the next harvest" (Courtney, 1890).',
      yule: 'East Cornwall: "It is hung up in the kitchen until Christmas-day, when it is given to the best ox in the stalls" (Courtney, 1890).',
    },
    lore: 'In Devon and Cornwall the reaper who made the neck went through the last sheaves and picked out "the best ears he can find" (Hunt), and it was held up and cried. In West Cornwall the oldest reaper shouted "I hav\'et! I hav\'et! I hav\'et!" (Courtney). Then it was hung up in the farmhouse kitchen. Hunt says it "often remains for three or four years"; Courtney gives West Cornwall\'s neck a year, till the next harvest, and East Cornwall\'s till Christmas Day, when it went to the best ox.',
    tier: 'folk',
    source: 'R. Hunt, Popular Romances of the West of England (3rd ed., 1903), "Crying the Neck" · M. A. Courtney, Cornish Feasts and Folk-lore (1890), pp. 52–53',
  },
  kern: {
    name: 'The Kern Baby',
    short: 'kern baby',
    icon: '🎎',
    country: 'Northumberland and the Tweed side',
    how: 'Pick out the best ears, make a little figure of the sheaf, crown it with wheat-ears and dress it in finery. Then set it at the top of the dresser.',
    hangs: 'at the top of the dresser',
    put: 'set it at the top of the dresser',
    ends: {
      harvest: 'Henderson does not say how long a kern baby was kept. The game keeps it till the next harvest.',
    },
    lore: 'In the north of England the last of the corn was made into an image, "crowned with wheat-ears and dressed up in gay finery", carried on a pole to the barn and set up high over the harvest supper. Henderson saw smaller ones in cottages "on the Tweed side", usually of oats, "enshrined at the top of the bink or dresser" with the big dishes ranged either side. He does not say how long they stayed there.',
    tier: 'folk',
    source: 'W. Henderson, Notes on the Folk-Lore of the Northern Counties of England and the Borders (1879), pp. 87–88',
  },
  maiden: {
    name: 'The Maiden',
    short: 'Maiden',
    icon: '🎀',
    country: 'the Highlands and the north-east of Scotland',
    how: 'Pick out the best ears of the last handful and dress it up as a Harvest Maiden. Then hang it up in the house.',
    hangs: 'hung up in the house',
    put: 'hang it up in the house',
    ends: {
      harvest: 'The Highlands: "hung up in the farmer\'s house to aid in keeping them out till next harvest", the fairies (Campbell, 1900).',
      yule: 'North-east Aberdeenshire: it "is kept till Christmas morning, and is then given to one or more of the horses or to the cattle of the farm" (Gregor, as Frazer gives it, 1912).',
      plough: 'Kilmartin, Argyll: "On the first day of ploughing a tuft of it was given" to the horses (as Frazer gives it, 1912).',
    },
    lore: 'In the Highlands "the last handful of corn reaped should be dressed up as a Harvest Maiden", and it was "hung up in the farmer\'s house to aid in keeping them out till next harvest": the fairies (Campbell). To be last to finish was another thing: the first farm done made a doll of corn blades, the "old wife", and sent it on to the next, and whoever was left with it had the "famine of the farm" to keep till next harvest (Campbell). Elsewhere in Scotland the Maiden went to the beasts at Christmas, or a tuft of it to the horses at the first ploughing.',
    tier: 'folk',
    source: 'J. G. Campbell, Superstitions of the Highlands and Islands of Scotland (1900) · J. G. Frazer, The Golden Bough, 3rd ed., vol. 7, Spirits of the Corn and of the Wild I (1912), ch. V, quoting W. Gregor and an account from Kilmartin',
  },
};

// Picking out the best ears: nine from the last sheaves, some full and some
// thin. Take every full ear and none of the thin.
const SHEAF_EARS = [true, false, true, true, false, true, true, false, true];

const SHEAF_KEEP_MIN_MS = 30 * 24 * 3600 * 1000;  // a sheaf hangs a while before its end comes
const SHEAF_REPLACE_MS = 150 * 24 * 3600 * 1000;  // …and a whole year (near enough) before the next harvest's replaces it
const SHEAF_END_XP = 40;

// null if the plaiting is right, else why not.
function sheafProblem(m) {
  if (!m || typeof m !== 'object') return 'Choose which sheaf to plait first.';
  const form = SHEAF_FORMS[m.form];
  if (!form) return 'Choose which sheaf: the neck, the kern baby or the Maiden.';
  if (!SHEAF_ENDS[m.end] || !form.ends[m.end]) return `That is not how ${form.name.toLowerCase()} ended its year in the record.`;
  const ears = Array.isArray(m.ears) ? [...new Set(m.ears.map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < SHEAF_EARS.length) : [];
  if (!ears.length) return 'Pick out the best ears first.';
  if (ears.some((i) => !SHEAF_EARS[i])) return 'There is a thin ear in that handful. Only the best ears go in.';
  if (ears.length < SHEAF_EARS.filter(Boolean).length) return 'There are better ears still lying there. Take all the best ones.';
  return null;
}

// Can a sheaf be plaited now? At harvest, if none hangs or the one that does
// has had its year.
function sheafCanPlait(season, sheaf, now) {
  if (!SHEAF_PLAIT_SEASONS.includes(season)) return false;
  return !sheaf || (now - (sheaf.at || 0)) >= SHEAF_REPLACE_MS;
}

// Has the hanging sheaf's end come round (Christmas, or the first ploughing)?
function sheafEndDue(season, sheaf, now) {
  if (!sheaf) return false;
  const end = SHEAF_ENDS[sheaf.end];
  if (!end || !end.act) return false;
  return end.when.includes(season) && (now - (sheaf.at || 0)) >= SHEAF_KEEP_MIN_MS;
}

// "Lughnasadh or Mabon", "Imbolc or Ostara".
function sheafWhenLabel(seasons) {
  const names = seasons.map((s) => SHEAF_SEASON_NAMES[s] || s);
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0];
}

module.exports = {
  SHEAF_FORMS, SHEAF_ENDS, SHEAF_EARS, SHEAF_PLAIT_SEASONS, SHEAF_KEEP_MIN_MS, SHEAF_REPLACE_MS, SHEAF_END_XP,
  sheafProblem, sheafCanPlait, sheafEndDue, sheafWhenLabel,
};
