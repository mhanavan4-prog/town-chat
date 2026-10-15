'use strict';
// Class showcase data (Session N) — the per-class pages at /class/:id.
//
// Display copy for each of the six callings: the 3D model to show, a tagline,
// and the full ability kit (icon / name / what-it-does). The ability text
// MIRRORS the client-side SPELL_CATALOG / *_ATTACK_CATALOG in client/main.js
// (the player-facing tooltips), kept here as plain data so the standalone
// showcase page can render without booting the game bundle. If an ability's
// name/description changes in the client catalog, update it here too.
//
// Served by GET /api/class/:id; the page itself is public/class.html.

const CLASSES = [
  {
    id: 0, key: 'witch', name: 'Witch', model: 'kk/Mage.glb',
    tagline: 'Casts hexes and blessings from a Spellbook.',
    blurb: 'A full book of curses, wards and sight — control the town square without ever landing a blow.',
    abilities: [
      { icon: '👁️', name: 'Open 3rd Eye', description: "Asks another player to open their camera — only with their permission — and sends a photo of them back to you as a note. They choose whether to accept." },
      { icon: '🐸', name: "Toad's Tongue", description: 'Curses the target to croak mid-sentence in chat for a while.' },
      { icon: '🦶', name: 'Stumble Hex', description: 'Draws a witchy sigil on the ground — anyone who steps into it gets hexed with halved walking speed.' },
      { icon: '🔥', name: 'Fireball', description: 'Hurls a roaring ball of witchfire at the target for real damage.' },
      { icon: '🥀', name: 'Withering Hex', description: "Rots the target's vitality — their life withers away for ten dreadful seconds. It cannot kill, only carry them to the brink." },
      { icon: '🩸', name: 'Leech Hex', description: 'Sinks phantom fangs into the target — the life it drains seeps back into your own veins.' },
      { icon: '👹', name: 'Monstrous Form', description: 'Swell into a hulking horror — while transformed, your strikes and spells hit half again as hard.' },
      { icon: '🎃', name: 'Gourd Ward', description: 'Hollow out your skull into a sacred ward-gourd — while it grins, all harm against you is halved.' },
      { icon: '🪽', name: "Raven's Cloak", description: 'Dissolve into a flurry of black feathers — your steps quicken to twice their pace, to flee or to chase.' },
      { icon: '🦴', name: 'Bone-Knit Blessing', description: 'Whisper the old words over your own bones — wounds slowly knit themselves closed for twelve seconds.' },
      { icon: '🔮', name: 'Scrying Orb', description: 'Peer into the orb at a chosen soul — learn where they are, how wounded, how seasoned, and what curse rides them.' },
      { icon: '🦇', name: 'Nightwing Augury', description: 'Loose your bats across the whole realm — they return whispering every soul’s whereabouts and wounds.' }
    ]
  },
  {
    id: 1, key: 'werewolf', name: 'Werewolf', model: 'kk/Barbarian.glb',
    tagline: 'Unleashes a dozen ferocious attacks.',
    blurb: 'Fangs, fear and the hunt — the most aggressive kit in town, built to chase down and run down prey.',
    abilities: [
      { icon: '🦷', name: 'Savage Bite', description: 'Sink your fangs in for real damage — players, animals, and mobs alike, same death/respawn/loot flow as a melee Strike.' },
      { icon: '🛡️', name: 'Iron Pelt', description: 'Your fur bristles into iron — while it holds, ALL damage against you is halved.' },
      { icon: '🌙', name: 'Moonlit Mending', description: 'Moonlight seeps into your wounds — they slowly knit closed for twelve seconds.' },
      { icon: '🐾', name: 'Rapid Swipe', description: "Lifts one undestroyed note straight out of the target's inbox before they can burn it — or comes up empty if they have none." },
      { icon: '🌕', name: 'Lunar Howl', description: 'A moon-splitting howl halves the movement speed of everyone in range.' },
      { icon: '😱', name: 'Terrifying Roar', description: "A roar so fearsome it scrambles nearby players' words in chat." },
      { icon: '🐺', name: 'Alpha Bite', description: 'Chomps the target down to half their size.' },
      { icon: '💨', name: 'Feral Dash', description: 'Surges with wolf speed — doubles movement for a short burst.' },
      { icon: '🩸', name: 'Blood Frenzy', description: "Swells with feral rage — doubles the Werewolf's size." },
      { icon: '🔶', name: 'Wolf Mark', description: 'Brands the target as prey — they take +30% damage for 12s.' },
      { icon: '🔥', name: 'Feral Haze', description: "Clouds the target's senses — their controls reverse for 4s." },
      { icon: '😤', name: 'Snarl', description: 'A bone-chilling snarl roots the target in place for 3s.' },
      { icon: '🎯', name: 'Scent Trail', description: "Howls at the target, inviting them to howl back. If they join in, their approximate real-world location (never exact) is sent to you privately — entirely their choice, and never posted anywhere." },
      { icon: '🐺', name: "Hunter's Read", description: "Swipe a nearby player and tear loose their rap sheet — their kills, deaths and notoriety, how long they've prowled, and a cold read of their class, level, health and gear. All in-world record, nothing real-world." }
    ]
  },
  {
    id: 2, key: 'mystic', name: 'Mystic', model: 'kk/Rogue_Hooded.glb',
    tagline: 'Sees what others cannot — and mends them.',
    blurb: 'The spirit-medium: damage and leech, wards for self and allies, the only targeted heal, and realm-wide sight.',
    abilities: [
      { icon: '👻', name: 'Spirit Lash', description: 'A whipcrack of furious spirits — real damage to players, animals, and mobs alike.' },
      { icon: '💜', name: 'Soul Siphon', description: 'Draw the living warmth out of the target — everything it drains flows back into your own veins.' },
      { icon: '😱', name: 'Banshee Wail', description: 'A grave-cold shriek — everyone in range shrinks in terror to half their size.' },
      { icon: '🌫️', name: 'Ethereal Veil', description: 'Slip halfway behind the veil — while you shimmer, ALL damage against you is halved.' },
      { icon: '🕯️', name: 'Spirit Ward', description: 'Set a protective spirit on another player — ALL damage against them is halved while it watches.' },
      { icon: '👣', name: 'Ghost Step', description: 'Walk the way the dead do — twice your pace, for slipping away or closing in.' },
      { icon: '🕊️', name: 'Séance of Mending', description: 'Kindly spirits fuss over your wounds — they slowly knit closed for twelve seconds.' },
      { icon: '💚', name: 'Mending Spirits', description: 'Send your gentlest spirits to another player — they restore a solid chunk of health on the spot.' },
      { icon: '🤫', name: 'Whispered Secret', description: 'The dead gossip terribly. Learn where a chosen soul is, how wounded, how seasoned, and what curse rides them.' },
      { icon: '🌀', name: 'Spirit Walk', description: "Step out of your body and sweep the whole realm — return knowing every soul's whereabouts and wounds." },
      { icon: '🦇', name: 'Haunting', description: 'Restless spirits turn the target around — their controls reverse for 4s.' },
      { icon: '🥶', name: 'Graveyard Chill', description: "The cold of the old yard seeps into the target's bones, halving their walking speed." }
    ]
  },
  {
    id: 3, key: 'knight', name: 'Knight', model: 'kk/Knight.glb',
    tagline: "The town's steel shield.",
    blurb: 'The oathbound order: the hardest single hit in the game, crowd control, wards for allies, and the counter to the hunt.',
    abilities: [
      { icon: '⚔️', name: 'Smite', description: "Bring the order's judgment down in one blow — the hardest-hitting single attack any class owns." },
      { icon: '🛡️', name: 'Shield Bash', description: 'Stagger the target with your shield — their walking speed is halved while their ears ring.' },
      { icon: '🔥', name: 'Rallying Wrath', description: 'Swell with righteous fury — while it burns, your strikes and attacks hit half again as hard.' },
      { icon: '⚙️', name: 'Oath of Iron', description: 'Recite the old vow — while it holds, ALL damage against you is halved.' },
      { icon: '🤝', name: "Guardian's Pledge", description: 'Swear your shield to another player — ALL damage against them is halved while your pledge stands.' },
      { icon: '🩹', name: 'Field Dressing', description: 'Bind your own wounds the way the garrison taught — they slowly close for twelve seconds.' },
      { icon: '💚', name: 'Lay on Hands', description: "The order's oldest mercy — restore a solid chunk of another player's health on the spot." },
      { icon: '🗼', name: "Sentinel's Watch", description: 'A sentinel misses nothing. Learn where a chosen player is, how wounded, how seasoned, and what afflicts them.' },
      { icon: '📯', name: "Herald's Muster", description: "Sound the muster and take the roll — one report naming every player's whereabouts and wounds." },
      { icon: '🔶', name: 'Challenge', description: 'Call out the target — marked, they take +30% damage for 12s.' },
      { icon: '🥾', name: 'Steadfast March', description: 'Fall into the old march cadence — twice your pace for a short burst.' },
      { icon: '🚩', name: 'Banner of Dread', description: 'Plant a banner so grim that everyone in range falters, their walking speed halved.' },
      { icon: '🛡️', name: "Guardian's Veil", description: "Raise a ward over everyone around you — yourself included. While it holds, a Werewolf's Hunter's Read, Rapid Swipe and Scent Trail all fail against those you shelter. The counter to the hunt." }
    ]
  },
  {
    id: 4, key: 'wanderer', name: 'Wanderer', model: 'kk/Rogue.glb',
    tagline: 'Unleashes a dozen wandering skills.',
    blurb: 'The road-worn traveller: thrown blades, stealth, pickpocketing, and a spyglass into any room in town.',
    abilities: [
      { icon: '🔪', name: 'Knife Throw', description: 'A travel-worn blade thrown hard and true — real damage to players, animals, and mobs alike.' },
      { icon: '🍵', name: 'Trail Remedy', description: 'An old road-tonic from the bottom of your pack — wounds slowly mend for twelve seconds.' },
      { icon: '🛡️', name: "Packmule's Guard", description: 'Brace behind your pack like a seasoned road-fighter — while it holds, ALL damage against you is halved.' },
      { icon: '🔭', name: 'Spy Glass', description: "Peer into a building of your choice from anywhere — opens a live window into that room's chat for 60 seconds. Everyone in that room is told the moment you cast it." },
      { icon: '🤏', name: 'Sleight of Hand', description: "Peek into a target's pockets and try to lift an item. They won't know if you're successful — only a failed attempt gives you away. Starts at 35% and grows with practice, up to 94% at max skill." },
      { icon: '🏞️', name: 'Echo Canyon', description: "A canyon echo scrambles everyone nearby's words in chat." },
      { icon: '🧘', name: 'Deep Meditation', description: 'Sink into a deep trance — for a full minute NO attack can touch you, PvP or monster. The vow: you cannot strike while you meditate.' },
      { icon: '🎒', name: 'Heavy Pack', description: "Hurl your crushing pack onto the target — real damage, and its weight ROOTS them in place for four seconds." },
      { icon: '🥿', name: 'Endless Road', description: "Curses the target's boots — the road stretches on forever, halving their speed." },
      { icon: '🪶', name: 'Featherlight Pack', description: 'Shed every ounce of weight and go featherlight for fifteen seconds — attacks slip clean past you and roaming creatures lose your trail, with a burst of speed to vanish.' },
      { icon: '🦉', name: 'Shadow Owls', description: 'Loose a swarm of night owls that dive and rend — the hardest-hitting single strike any class owns, players and monsters alike.' },
      { icon: '🥾', name: 'Wanderlust', description: 'A surge of wanderlust quickens your pace for a short burst.' },
      { icon: '🔥', name: 'Campfire Tale', description: 'Tall tales by the campfire make you feel larger than life.' },
      { icon: '🌌', name: 'Nightwatch Cloak', description: 'Melt into the hush of the night watch — for thirty seconds you vanish completely from every other player, moving unseen at twice your pace. You still see yourself.' },
      { icon: '🧭', name: 'Compass Trick', description: "Bends the target's compass needle back toward you, revealing where they are." }
    ]
  },
  {
    id: 5, key: 'lich', name: 'Lich', model: 'kk/Skeleton_Mage.glb',
    tagline: 'Raises the undead to fight for you.',
    blurb: 'The summoner: three tiers of undead that rise and fight until slain, plus a life-draining strike and grave-cold curses.',
    abilities: [
      { icon: '💀', name: 'Raise Skeleton', description: 'Tear a Risen Skeleton up out of the ground. It hunts nearby foes and fights until it is cut down. Its strength grows with your level and your ritual rank.' },
      { icon: '🦴', name: 'Raise Bone Knight', description: 'Raise a Bone Knight — a sturdier, harder-hitting undead. Answers at Level 7.' },
      { icon: '☠️', name: 'Raise Grave Wight', description: 'Call up a Grave Wight, the deadliest of your bound dead. Answers at Level 13.' },
      { icon: '🩸', name: 'Life Siphon', description: "Drain a target's life across the gap — the stolen vitality closes your own wounds." },
      { icon: '🦴', name: 'Bone Ward', description: 'Lattice your body in bone — all damage against you is halved while it holds.' },
      { icon: '🥶', name: 'Grave Chill', description: 'Wither a foe with grave-cold — they take amplified damage from every source while it lasts (your undead love this).' }
    ]
  }
];

const BY_ID = {};
for (const c of CLASSES) BY_ID[c.id] = c;

module.exports = { CLASSES, byId: (id) => BY_ID[id] || null };
