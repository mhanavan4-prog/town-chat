// Player Titles — honorifics earned through play (coven Rites to start). An
// account accumulates earned title ids (playerProgress[key].riteTitles) and may
// set one active (playerProgress[key].activeTitle), which shows on their
// nameplate. Pure data; the server grants ids and the client renders from this
// catalog. Keep ids stable — they're persisted on accounts.
const TITLES = {
  hollow_vigil: {
    id: 'hollow_vigil', name: 'Keeper of the Hollow Vigil', glyph: '🕯️',
    desc: 'Kept the Samhain vigil and held the veil against the dead.',
    from: 'The Hollow Vigil — Samhain'
  },
  sunreturn: {
    id: 'sunreturn', name: 'Warden of the Returning Sun', glyph: '☀️',
    desc: 'Held the longest night until the new sun climbed clear.',
    from: 'The Sunreturn Vigil — Yule'
  }
};

function titleName(id) { return (TITLES[id] && TITLES[id].name) || null; }
function titleExists(id) { return !!TITLES[id]; }

module.exports = { TITLES, titleName, titleExists };
