// Story & quest data (Tier 3.4 Phase A). Extracted verbatim from server.js.
// Pure data: references no server state or helpers. The derived QUEST_BY_NPC
// map and the STORYLINES-processing loop stay in server.js and read these.

const QUEST_CATALOG = {
  // ── Town quests (Ranger / Herbalist / Hunter / Scholar) ──────────────────
  rangers_cull: {
    npcId: 'npc_mara', npcName: 'Ranger Mara',
    name: 'Cull the Night Creatures',
    type: 'kill_mob', target: 3, xpReward: 75, goldReward: 40,
    itemRewards: [{ itemId: 'healing_potion', qty: 2 }],
    description: 'Three night creatures have been spotted near the Wilds portal. Put them down before dawn.'
  },
  herbalists_gather: {
    npcId: 'npc_finn', npcName: 'Herbalist Finn',
    name: 'Gather Wild Herbs',
    type: 'harvest_plant', target: 5, xpReward: 60, goldReward: 30,
    itemRewards: [{ itemId: 'magic_scroll', qty: 1 }],
    description: 'My supply is running low. Bring me five plants from the Wilds — any kind will do.'
  },
  hunters_hunt: {
    npcId: 'npc_dex', npcName: 'Hunter Dex',
    name: 'Slay the Greater Beasts',
    type: 'kill_mob', target: 5, xpReward: 120, goldReward: 60,
    itemRewards: [{ itemId: 'animal_pelt', qty: 2 }],
    description: 'The Wilds are crawling with foul things at night. Hunt five of them and I\'ll make it worth your while.'
  },
  scholars_find: {
    npcId: 'npc_lyra', npcName: 'Scholar Lyra',
    name: 'Find Healing Herbs',
    type: 'harvest_specific', targetItemId: 'healing_herb', target: 3, xpReward: 90, goldReward: 50,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }],
    description: 'I need healing herbs for my research — three of them from the Wilds. They\'re the bright green sprouts.'
  },

  // ── The Unbound Circle (western wilds, ~2200,5000) ────────────────────────
  circles_first_rite: {
    npcId: 'npc_morvaine', npcName: 'Elder Morvaine',
    name: 'Spirits of the Corrupted',
    type: 'kill_mob', target: 6, xpReward: 100, goldReward: 80,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }, { itemId: 'healing_potion', qty: 2 }],
    description: 'The corruption that bled from the Hollow has twisted the creatures of the Thornreach. Six of them must be put down. This is the first step of the old rite — do not falter.'
  },
  circles_second_rite: {
    npcId: 'npc_talwyn', npcName: 'Sister Talwyn',
    name: 'The Ancient Harvest',
    type: 'harvest_plant', target: 8, xpReward: 120, goldReward: 100,
    itemRewards: [{ itemId: 'druid_stone', qty: 1 }, { itemId: 'magic_scroll', qty: 2 }],
    description: 'The Fifth Severance requires the living essence of untouched plants — the old grove still holds some. Gather eight offerings from the Wilds. I can feel the seal weakening as we speak.'
  },
  circles_final_rite: {
    npcId: 'npc_caelum', npcName: 'Brother Caelum',
    name: 'Thornreach\'s Last Hunt',
    type: 'kill_mob', target: 10, xpReward: 180, goldReward: 200,
    itemRewards: [{ itemId: 'spirit_ring', qty: 1 }, { itemId: 'hollow_shard', qty: 2 }],
    description: 'The Hollow draws strength from its servants. Ten more must fall before Elder Morvaine can attempt the sealing ritual. Every corrupted creature you slay brings the Thornreach closer to peace.'
  },

  // ── The Thornwarden Scouts (eastern wilds, ~7800,5000) ───────────────────
  thorns_sweep: {
    npcId: 'npc_rhedyn', npcName: 'Captain Rhedyn',
    name: 'Eastern Sweep',
    type: 'kill_mob', target: 8, xpReward: 120, goldReward: 100,
    itemRewards: [{ itemId: 'leather_hide', qty: 3 }, { itemId: 'healing_potion', qty: 1 }],
    description: 'Corrupted creatures have broken through the eastern perimeter. Eight of them need to fall before they regroup. Move fast — we cannot let them reach the village.'
  },
  thorns_salvage: {
    npcId: 'npc_brynn', npcName: 'Quartermaster Brynn',
    name: 'Material Salvage',
    type: 'harvest_plant', target: 10, xpReward: 140, goldReward: 150,
    itemRewards: [{ itemId: 'lumber_bundle', qty: 3 }, { itemId: 'iron_ore', qty: 2 }],
    description: 'The camp fortifications are deteriorating. I need raw material from the Wilds — harvest what you can find. The builders need lumber desperately. Every bundle helps.'
  },
  thorns_assault: {
    npcId: 'npc_elara', npcName: 'Scout Elara',
    name: 'Storm the Hollows',
    type: 'kill_mob', target: 12, xpReward: 200, goldReward: 250,
    itemRewards: [{ itemId: 'stone_block', qty: 3 }, { itemId: 'iron_ingot', qty: 2 }, { itemId: 'enchanted_fur', qty: 1 }],
    description: 'My scouts tracked a corrupted convergence node east of the camp. Twelve of them must be destroyed before they coalesce into something none of us can stop. This is our moment — do not waste it.'
  },

  // ── Town side quests, wave two — every shopkeeper and hint-giver in the
  // buildings now has one repeatable job of their own (same 24h cooldown,
  // same one-active-quest rule). The hint NPCs keep their hint role for
  // npc_hint_talk; quest_talk just finds these first via QUEST_BY_NPC. ────
  barkeeps_cellar: {
    npcId: 'npc_bartender', npcName: 'Barkeep Joss',
    name: 'Something in the Cellar',
    type: 'kill_mob', target: 3, xpReward: 50, goldReward: 25,
    itemRewards: [{ itemId: 'berries', qty: 3 }],
    description: 'Every night something scratches under the cellar door — and every morning a barrel\'s gone sour. Whatever the Hollow\'s sending out after dark, thin it out for me. Three of them, and drinks are on the house. Well. Berries are.'
  },
  scholars_lotus: {
    npcId: 'npc_scholar', npcName: 'Scholar Elior',
    name: 'Lotus for the Archive',
    type: 'harvest_specific', targetItemId: 'meditation_lotus', target: 2, xpReward: 70, goldReward: 40,
    itemRewards: [{ itemId: 'magic_scroll', qty: 1 }],
    description: 'The old registers must be read in perfect stillness of mind — the dead resent a distracted reader. Two Meditation Lotus blooms from the Wilds, and I can finish transcribing the pages that whisper back.'
  },
  apothecary_toadstools: {
    npcId: 'npc_apothecary', npcName: 'Apothecary Vex',
    name: 'Toadstools for the Till',
    type: 'harvest_specific', targetItemId: 'toadstool', target: 3, xpReward: 70, goldReward: 40,
    itemRewards: [{ itemId: 'healing_potion', qty: 2 }],
    description: 'Don\'t ask what the toadstools are for. Fine — it\'s a tincture for nightmares. HALF the town has the same nightmare lately, about a door underground, and my shelves are bare. Three toadstools from the Wilds, quick as you can.'
  },
  tailors_feathers: {
    npcId: 'npc_tailor', npcName: 'Tailor Ines',
    name: 'Feathers for a Funeral Coat',
    type: 'harvest_specific', targetItemId: 'ravens_feather_plant', target: 2, xpReward: 70, goldReward: 40,
    itemRewards: [{ itemId: 'silver_ring', qty: 1 }],
    description: 'A commission came in last night: a mourning coat, raven-feather trim, to be left — I\'m quoting the letter — "at the cave mouth where the rabbits won\'t graze." Paid in advance. In very old coins. Two Raven\'s Feathers from the Wilds and we never speak of this again.'
  },
  armorers_temper: {
    npcId: 'npc_armorer', npcName: 'Armorer Beck',
    name: 'Test the Temper',
    type: 'kill_mob', target: 6, xpReward: 110, goldReward: 60,
    itemRewards: [{ itemId: 'iron_ore', qty: 2 }],
    description: 'I\'ve been folding a new batch of steel with iron that came out of the Wilds, and I need to know if it holds against what LIVES out there before I sell a single blade of it. Six of the dark things, put down. Bring me back the dents.'
  },
  mabels_posies: {
    npcId: 'npc_patron', npcName: 'Old Mabel',
    name: "Mabel's Posies",
    type: 'harvest_plant', target: 4, xpReward: 55, goldReward: 30,
    itemRewards: [{ itemId: 'berries', qty: 2 }],
    description: 'Sixty years I\'ve put fresh flowers on the windowsill and the tavern\'s never once had a haunting INSIDE. That\'s not luck, dear, that\'s protocol. My knees won\'t do the Wilds anymore — four green things, any kind the ground will give you.'
  },
  wrens_errand: {
    npcId: 'npc_apprentice', npcName: 'Apprentice Wren',
    name: "Wren's Errand",
    type: 'harvest_specific', targetItemId: 'swift_root', target: 2, xpReward: 65, goldReward: 35,
    itemRewards: [{ itemId: 'magic_scroll', qty: 1 }],
    description: 'Master says I\'m not allowed in the Wilds after what happened to the LAST apprentice — no, I don\'t know what happened, that\'s the problem, nobody finishes the sentence. Anyway: two Swift Roots for the workshop? I\'ll owe you a scroll and my entire life.'
  },
  oswins_springs: {
    npcId: 'npc_tinkerer', npcName: 'Tinkerer Oswin',
    name: 'Springs and Sinews',
    type: 'kill_mob', target: 4, xpReward: 85, goldReward: 45,
    itemRewards: [{ itemId: 'iron_ingot', qty: 1 }],
    description: 'I\'m building a bell that rings when the Hollow\'s creatures come within a mile. Prototype needs calibrating against the real thing, and the real thing keeps EATING my test rigs. Four of them destroyed near town and my readings will finally settle.'
  },
  corwins_corsage: {
    npcId: 'npc_noble', npcName: 'Lady Corwin',
    name: 'A Corsage for the Séance',
    type: 'harvest_specific', targetItemId: 'rainbow_petal', target: 2, xpReward: 75, goldReward: 50,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }],
    description: 'I am hosting a séance on Thursday — everyone who matters will be there, and half of everyone who mattered. The dead have STANDARDS, darling. Two Rainbow Petals from the Wilds for the table arrangement, and do try not to bleed on them.'
  },
  dorrans_patrol: {
    npcId: 'npc_knight', npcName: 'Sir Dorran',
    name: 'The Old Patrol',
    type: 'kill_mob', target: 8, xpReward: 130, goldReward: 80,
    itemRewards: [{ itemId: 'steel_shield', qty: 1 }],
    description: 'Five hundred years ago the garrison walked a patrol route every night — town gate, tree line, back. Nobody\'s walked it since before my grandfather. I\'m too old and it shows. Walk the old route after dark and put down eight of whatever\'s moved into it.'
  },
  petras_watch: {
    npcId: 'npc_guard', npcName: 'Guard Petra',
    name: 'Night Watch Relief',
    type: 'kill_mob', target: 5, xpReward: 95, goldReward: 55,
    itemRewards: [{ itemId: 'healing_potion', qty: 1 }, { itemId: 'leather_hide', qty: 1 }],
    description: 'Between us: there are two of us on the night roster, and one of us is a rooster. The things that come out after dark are getting bolder — five fewer of them tonight and maybe I sleep a full shift for once. You didn\'t hear the part about sleeping.'
  },

  // ── Session M — creature hunts. Each of the twelve new Wilds creatures
  // anchors one quest, spread across the existing quest-givers (each now
  // carries a second job via QUEST_BY_NPC rotation). kill_creature counts
  // only kills of the named quarry (its type is passed as the event itemId).
  // ── Peaceful prey (gather materials) ──
  emberwing_dust: {
    npcId: 'npc_lyra', npcName: 'Scholar Lyra',
    name: 'Dust of the Emberwings',
    type: 'kill_creature', targetCreature: 'embermoth', target: 4, xpReward: 75, goldReward: 45,
    itemRewards: [{ itemId: 'magic_scroll', qty: 1 }],
    description: 'The Embermoths carry a glimmerdust on their wings that still holds a little of the old light — the kind my inks have lacked for a decade. Four of them drift the Wilds at dusk. Bring me what the wings give up, and I\'ll finally set down what the dark keeps trying to erase.'
  },
  thistle_forage: {
    npcId: 'npc_mara', npcName: 'Ranger Mara',
    name: 'The Root-Snufflers',
    type: 'kill_creature', targetCreature: 'thistlehog', target: 4, xpReward: 70, goldReward: 40,
    itemRewards: [{ itemId: 'healing_potion', qty: 1 }],
    description: 'Thistlehogs have been rooting up the warding-herbs faster than they regrow — spiny little things, they curl up and trundle off the moment they see you. Thin four of them from the Wilds so the herbs get a season to breathe. Watch the quills.'
  },
  duskfawn_hunt: {
    npcId: 'npc_dex', npcName: 'Hunter Dex',
    name: 'A Fawn for the Larder',
    type: 'kill_creature', targetCreature: 'duskfawn', target: 3, xpReward: 80, goldReward: 55,
    itemRewards: [{ itemId: 'animal_pelt', qty: 2 }],
    description: 'The Duskfawn are the only honest meat left in the Thornreach — everything else out there I wouldn\'t feed a dog. They bound the second they spot you, so you\'ll earn it. Three from the Wilds, and the pelts are yours on top of the pay.'
  },
  mirefowl_pluck: {
    npcId: 'npc_apothecary', npcName: 'Apothecary Vex',
    name: 'Marsh-Down for the Poultice',
    type: 'kill_creature', targetCreature: 'mirefowl', target: 4, xpReward: 72, goldReward: 42,
    itemRewards: [{ itemId: 'healing_potion', qty: 2 }],
    description: 'Mirefowl down draws fever heat out of a wound better than anything on my shelf — don\'t ask how I know. They flush out of the marsh shallows in a panic of wings if you get close. Four of them from the Wilds and I\'ll not have to answer awkward questions at the next inquest.'
  },
  // ── Neutral (pick a fight, take the trophy) ──
  boar_cull: {
    npcId: 'npc_knight', npcName: 'Sir Dorran',
    name: 'The Tusked Menace',
    type: 'kill_creature', targetCreature: 'bramble_boar', target: 4, xpReward: 110, goldReward: 65,
    itemRewards: [{ itemId: 'leather_hide', qty: 2 }],
    description: 'A Bramble Boar will let you walk right past it — and gore you through the spine if you so much as brush its bristles. Four have staked the old patrol route and I\'ll not send a green recruit against them. Provoke them if you must, but put them down. Bring the hides.'
  },
  mossback_shells: {
    npcId: 'npc_armorer', npcName: 'Armorer Beck',
    name: 'A Shell Worth Forging',
    type: 'kill_creature', targetCreature: 'mossback_tortoise', target: 3, xpReward: 120, goldReward: 70,
    itemRewards: [{ itemId: 'iron_ingot', qty: 2 }],
    description: 'A Mossback\'s shell is the toughest natural plate in the Thornreach — I want to laminate a shield with it. Trouble is, the beast barely notices a sword; you have to REALLY commit before it deigns to fight back. Three shells off their backs. Mind it doesn\'t sit on you.'
  },
  crow_feathers: {
    npcId: 'npc_tailor', npcName: 'Tailor Ines',
    name: 'Feathers Fit for Mourning',
    type: 'kill_creature', targetCreature: 'gravewing_crow', target: 5, xpReward: 100, goldReward: 60,
    itemRewards: [{ itemId: 'silver_ring', qty: 1 }],
    description: 'The Gravewing Crows keep the graveyard and resent anyone who lingers — disturb their patch and the whole flock comes down beak-first. Their feathers, though: black with a violet sheen no dye can match. Five birds\' worth for a very particular commission. I\'ll ask no questions if you don\'t.'
  },
  // ── Hostile (the Hollow's new nightstalkers) ──
  circle_hexers: {
    npcId: 'npc_morvaine', npcName: 'Elder Morvaine',
    name: 'Silence the Fen Hexers',
    type: 'kill_creature', targetCreature: 'fen_hexer', target: 5, xpReward: 150, goldReward: 90,
    itemRewards: [{ itemId: 'enchanted_gem', qty: 1 }, { itemId: 'hollow_shard', qty: 1 }],
    description: 'The Fen Hexers are no dumb beast — they were coven once, before the Hollow hollowed them. Now they hang back in the dark and throw their hexes from range. Five must be silenced before their casting weakens the seal further. Close the distance fast; they are frail once you reach them.'
  },
  thorn_swarm: {
    npcId: 'npc_rhedyn', npcName: 'Captain Rhedyn',
    name: 'Clear the Grave-Mites',
    type: 'kill_creature', targetCreature: 'rot_swarm', target: 8, xpReward: 130, goldReward: 75,
    itemRewards: [{ itemId: 'leather_hide', qty: 2 }, { itemId: 'healing_potion', qty: 1 }],
    description: 'Grave-Mites boil up out of the rot in knots — one\'s nothing, but they come at you eight-strong and a recruit panics. Cull eight of the little horrors before they nest near the perimeter. Keep moving and don\'t let them surround you.'
  },
  barrow_dig: {
    npcId: 'npc_caelum', npcName: 'Brother Caelum',
    name: 'What Waits in the Barrows',
    type: 'kill_creature', targetCreature: 'barrow_maw', target: 4, xpReward: 160, goldReward: 100,
    itemRewards: [{ itemId: 'hollow_shard', qty: 2 }, { itemId: 'iron_ore', qty: 2 }],
    description: 'The Barrow Maws lie buried by the old graves and erupt claws-first when the unwary pass. Four have taken root in the Wilds. Walk their ground, let them come — then send them back into it for good. The Circle needs the shards they carry.'
  },
  gloom_wings: {
    npcId: 'npc_elara', npcName: 'Scout Elara',
    name: 'The Things That Swoop',
    type: 'kill_creature', targetCreature: 'gloom_bat', target: 6, xpReward: 145, goldReward: 85,
    itemRewards: [{ itemId: 'enchanted_fur', qty: 1 }, { itemId: 'iron_ingot', qty: 1 }],
    description: 'My scouts keep coming back a pint low and can\'t say why — it\'s the Gloom Bats, wheeling in out of the dark and siphoning life with every pass. Fast, and they never hold still. Down six of them over the Wilds after nightfall and my patrols might stop fainting on watch.'
  },
  gallows_warden: {
    npcId: 'npc_talwyn', npcName: 'Sister Talwyn',
    name: 'The Gallows Warden Rises',
    type: 'kill_creature', targetCreature: 'old_marrowe', target: 1, xpReward: 350, goldReward: 300,
    itemRewards: [{ itemId: 'spirit_ring', qty: 1 }, { itemId: 'hollow_shard', qty: 3 }, { itemId: 'bloodmoon_shard', qty: 1 }],
    description: 'On the Blood Moon — and only then — a thing wearing the shape of a scarecrow rises in the Wilds graveyard: Old Marrowe, the Gallows Warden, the Hollow\'s own steward. It is more than any single blade should face. Gather your strength, wait for the red moon, and end it. Do this and the Circle will name you kin.'
  }
};

const STORYLINES = {
  0: {
    title: 'The Fifth Hand', icon: '🖐️',
    tagline: 'The Old Circle had five ritualists. Four graves are accounted for.',
    chapters: [
      { id: 'w1', title: 'The Summons', objective: { type: 'talk_npc', npcId: 'npc_lyra', target: 1, label: 'Speak with Scholar Lyra in the town square' },
        intro: 'A letter is nailed to your door with a rusted athame. The wax seal shows five hands in a ring — one of them scratched out. "You feel it too, don\'t you? The pull under your ribs when the moon is thin. Ask the scholar what the Circle buried. Ask her what they COULDN\'T." It is signed only: H.',
        outro: 'Lyra goes pale when she sees the seal. "Five ritualists performed the Severance. Four graves in the yard. The fifth… there IS no fifth grave. Hazel never died. She\'s still down there, under the Wilds, holding the seal shut with her own two hands. And if she\'s writing letters — she\'s getting tired."',
        xpReward: 40, goldReward: 20 },
      { id: 'w2', title: 'Reagents for the Rite', objective: { type: 'harvest_plant', target: 5, label: 'Gather 5 plants from the Wilds' },
        intro: 'A second letter, this one smelling of loam and candle smoke: "The seal drinks green things. Living essence, freely gathered. Bring what grows wild — the Hollow has already begun to sour the far groves, so take what you can while it still remembers the sun."',
        outro: 'As you pull the last root free, every bird in the Wilds goes silent at once. Something under the soil noticed the harvest. Something is counting along with you.',
        xpReward: 60, goldReward: 30 },
      { id: 'w3', title: 'The Keeper Below', objective: { type: 'visit_room', room: 'witch_cave', target: 1, label: "Find Witch Hazel's cave beneath the Wilds" },
        intro: '"Come down and meet me, heir. Bring the green things. The entrance is where the rabbits refuse to graze — they\'ve always known better than people." You realize you have never once seen a rabbit near the cave mouth in the north-west of the Wilds.',
        outro: 'Hazel looks a hundred years old and nineteen at once. "Five hundred years I\'ve held this door shut," she says, not turning around. "The other four got graves and statues. I got homework. You\'re the first one the letters reached — the Hollow ate the rest."',
        xpReward: 60, goldReward: 30 },
      { id: 'w4', title: 'Practice the Craft', objective: { type: 'cast_ability', target: 8, label: 'Cast 8 spells from your Spellbook' },
        intro: '"Your book is a battle kit, not a party trick. The Hollow\'s servants don\'t flinch at croaking curses — but fire, leeching, wards, the withering? Those it remembers. Those it FEARS. Practice, heir. Practice until your cooldowns sweat."',
        outro: 'The twelfth… the eighth casting leaves scorch marks in the shape of a hand on the ground. Five fingers. Hazel\'s voice in your head, amused: "It\'s starting to recognize you. Good. Let it be afraid."',
        xpReward: 80, goldReward: 40 },
      { id: 'w5', title: "Thin the Hollow's Reach", objective: { type: 'kill_mob', target: 8, label: 'Destroy 8 of the Hollow\'s creatures' },
        intro: '"Every creature it corrupts is a finger it pushes through the crack in the seal. Cut them off. Eight will make it pull the hand back — for a while. The Wilds after dark, the town outskirts at night, the Wastes if you\'re brave. Go be a horror story the Hollow tells its children."',
        outro: 'The eighth one doesn\'t dissolve like the others. It looks at you — with recognition — and says, in a voice like wet paper: "The fifth hand waves goodbye." Then it\'s gone. Hazel doesn\'t laugh when you tell her.',
        xpReward: 100, goldReward: 60 },
      { id: 'w6', title: 'Brew the Severing Draught', objective: { type: 'craft_potion', target: 1, label: "Brew any potion at Hazel's cauldron" },
        intro: '"The seal doesn\'t need a hero, heir. It needs a WITCH — one who can stand at my cauldron and make the old recipes listen. Brew. Anything. The point isn\'t the potion; the point is that the cauldron accepts your hands as Circle hands. Then I can finally, FINALLY rest one of mine."',
        outro: 'The cauldron goes still as glass when you finish, and for one heartbeat you see six hands reflected in it — yours, Hazel\'s four… and one more, pressed against the other side of the surface, patient. Hazel exhales for what sounds like the first time in centuries. "Welcome to the Circle, Fifth Hand. The staff is yours. The watch is ours."',
        xpReward: 200, goldReward: 150, itemRewards: [{ itemId: 'shadow_staff', qty: 1 }] }
    ]
  },
  1: {
    title: 'The First Bite', icon: '🌕',
    tagline: 'Every curse has a first link in its chain. Yours is still alive.',
    chapters: [
      { id: 'b1', title: 'Scent of the Past', objective: { type: 'talk_npc', npcId: 'npc_dex', target: 1, label: 'Speak with Hunter Dex in the town square' },
        intro: 'On the night of the full moon you dream of teeth that are not yours — older, yellower, remembering. You wake with dirt under your claws and one word scratched into your door from the OUTSIDE: "ASK THE HUNTER."',
        outro: 'Dex doesn\'t reach for his knife, which surprises you. "Been waiting for one of you to ask," he says. "Every wolf in this valley bites back to one first bite — the Old Wolf, cursed the night the Severance shattered. Wolfsbane remembers that night. Go pick some. It\'ll show you."',
        xpReward: 40, goldReward: 20 },
      { id: 'b2', title: 'Silver the Blood', objective: { type: 'harvest_specific', itemId: 'wolfsbane_bloom', target: 3, label: 'Gather 3 Wolfsbane Blooms in the Wilds' },
        intro: 'Wolfsbane grows where the curse walked. Three blooms, picked with your own cursed hands — Dex says they\'ll pull toward the place your bloodline started, like compass needles that smell blood.',
        outro: 'The third bloom wilts the moment you pick it, all three stems bending in the same direction: north-west, toward the cave under the Wilds where the rabbits never graze. Your teeth ache. That\'s where the First Bite happened.',
        xpReward: 60, goldReward: 30 },
      { id: 'b3', title: 'The Moon Remembers', objective: { type: 'kill_mob', target: 6, label: 'Put down 6 of the Hollow\'s night creatures' },
        intro: '"The Hollow\'s creatures carry a splinter of the same corruption that made the Old Wolf," Dex tells you. "Kill six. Not for the town — for the scent. You\'ll smell what your curse smelled the night it was born. Then you\'ll understand what you\'re walking into."',
        outro: 'He was right. Under the sixth one\'s rot you catch it: moonlight, wet fur, and terror — the exact smell of your own nightmares. The curse in your blood howls in recognition. It wants to go home.',
        xpReward: 80, goldReward: 40 },
      { id: 'b4', title: 'Howl at the Hollow', objective: { type: 'cast_ability', target: 8, label: 'Use 8 of your wolf attacks' },
        intro: 'The curse gets louder the closer you get to its source — so make it USEFUL. Howl, bite, dash, frenzy: eight times, until the wolf and you stop arguing about who\'s driving. A divided wolf dies at the Hollow\'s door. A whole one knocks.',
        outro: 'On the eighth, something in your chest clicks into place like a joint setting. The wolf isn\'t riding you anymore. You\'re not riding it. There\'s just one animal now, and it is very, very calm.',
        xpReward: 100, goldReward: 50 },
      { id: 'b5', title: 'Den of the First', objective: { type: 'visit_room', room: 'witch_cave', target: 1, label: 'Enter the cave beneath the Wilds' },
        intro: 'The wolfsbane pointed here. The witch who lives in the cave now — Hazel — was THERE the night the Severance shattered and the Old Wolf was made. She owes your bloodline an explanation. Walk into the den where your curse was born and get it.',
        outro: 'Hazel doesn\'t flinch at your shape. "I wondered which generation would finally track it back," she says. "The Old Wolf was our watchdog — the Circle\'s. The ritual broke him before it broke us. Everything he bit carried the break forward. You want it to end? It ends the way it started: blood, moonlight, and something stronger than the curse choosing to stop."',
        xpReward: 100, goldReward: 60 },
      { id: 'b6', title: 'Break the Chain', objective: { type: 'kill_mob', target: 10, label: 'Destroy 10 corrupted creatures as the whole wolf' },
        intro: '"The curse thins every time the Hollow does," Hazel says. "Ten more. Not as a victim of the bite — as the first wolf in five hundred years who OWNS it. Break enough links and the chain forgets the shape of your family entirely."',
        outro: 'The tenth falls, and for a moment the moon looks… ordinary. Just a rock in the sky. The hunger is still there — it\'s yours now, not the Old Wolf\'s — and hanging from the last creature\'s throat, impossibly clean, is a fang you recognize from your dreams. It stopped choosing violence long ago. Now it chooses you.',
        xpReward: 200, goldReward: 150, itemRewards: [{ itemId: 'alpha_fang', qty: 1 }] }
    ]
  },
  2: {
    title: 'Voices Beneath the Floorboards', icon: '🕯️',
    tagline: "The town's dead have started leaving reviews.",
    chapters: [
      { id: 'm1', title: 'The Whisperer', objective: { type: 'talk_npc', npcId: 'npc_scholar', target: 1, label: 'Speak with Scholar Elior in the Library' },
        intro: 'You hear them at the edges of sleep: the town\'s dead, murmuring under the floorboards like a dinner party in another room. Last night, for the first time, one of them said your NAME — and the rest went quiet, listening. The library keeps the town\'s death registers. Start there.',
        outro: 'Elior slides a ledger across without being asked. "Every medium who\'s lived here ends up at this desk eventually," he says. "The registers list forty-one graves in the old yard. The whispers you\'re hearing? I\'ve counted the distinct voices. There are forty-TWO."',
        xpReward: 40, goldReward: 20 },
      { id: 'm2', title: 'Grave Goods', objective: { type: 'harvest_plant', target: 6, label: 'Gather 6 offerings from the Wilds' },
        intro: 'The dead don\'t talk for free — the old rites paid them in living green things laid on the threshold. Six offerings from the Wilds. The forty-second voice is the one refusing to give a name, and politeness, Elior insists, is the only lockpick that works on the dead.',
        outro: 'You lay the sixth stem down and the whispers change tone — warmer, closer, like the other room\'s door has been opened a crack. Forty-one voices say thank you. One says: "She\'s listening. Careful."',
        xpReward: 60, goldReward: 30 },
      { id: 'm3', title: 'Where the Dead Drink', objective: { type: 'visit_room', room: 'cafe', target: 1, label: 'Visit the Cafe after the whispers lead you there' },
        intro: 'Follow the voices. They pool where the living gather and the boards are oldest — the tavern. The dead of this town, it turns out, never really left the bar. The forty-second voice goes there to LISTEN, the others say. To remember being warm.',
        outro: 'In the tavern the whispers are almost deafening — laughter, arguments, a toast repeated for two hundred years. And under it all, one voice not celebrating. Just watching. It was never buried in the yard, the others whisper. She went into the ground under the WILDS, holding something shut.',
        xpReward: 60, goldReward: 30 },
      { id: 'm4', title: 'Open the Channel', objective: { type: 'cast_ability', target: 8, label: 'Channel 8 of your mystic rites' },
        intro: 'To speak with the forty-second voice directly you\'ll need a wider channel than sleep\'s edge. Practice the rites — lash, siphon, veil, séance — eight workings, until the boundary knows your signature and stops checking your credentials at the door.',
        outro: 'On the eighth rite the veil doesn\'t part — it BOWS. The forty-second voice comes through clear at last, tired and amused: "Finally, a medium with manners. My name is Hazel. I\'m not dead, dear. But I\'ve been holding a door shut for five hundred years, and I need hands on the OTHER side of the floorboards."',
        xpReward: 80, goldReward: 40 },
      { id: 'm5', title: 'Quiet the Restless', objective: { type: 'kill_mob', target: 8, label: 'Put 8 corrupted creatures to rest' },
        intro: '"The things stalking the dark aren\'t alive," Hazel\'s voice explains. "They\'re stolen echoes — the Hollow wears the dead like costumes. Every one you cut down is a voice freed to come sit under the floorboards with the others, where it\'s warm. Eight, medium. Consider it hospice work."',
        outro: 'Each one you fell adds a new voice to the murmur under the boards — confused at first, then grateful, then GOSSIPING. The dead of Thornreach are delighted with you. The Hollow, noticeably, is not.',
        xpReward: 100, goldReward: 60 },
      { id: 'm6', title: 'The Last Séance', objective: { type: 'visit_room', room: 'witch_cave', target: 1, label: "Hold the séance in Hazel's cave itself" },
        intro: '"Come down in person," Hazel says. "Five hundred years of messages passed through walls — I want ONE conversation face to face. Bring the voices with you; they\'ve earned seats. We\'re going to show the Hollow what a town full of dead friends looks like when it stands up."',
        outro: 'The séance in the cave is the loudest silence you\'ve ever heard: forty-two voices and one witch, all facing the sealed door in the dark, together. The Hollow scratches once — and stops. "It counts too," Hazel grins, handing you a cloak that moves like breath. "And it just realized it\'s outnumbered."',
        xpReward: 200, goldReward: 150, itemRewards: [{ itemId: 'shadow_cloak', qty: 1 }] }
    ]
  },
  3: {
    title: 'The Hollow Oath', icon: '⚔️',
    tagline: 'Your order swore an oath five centuries ago. They lied about what it was.',
    chapters: [
      { id: 'k1', title: 'Orders from No One', objective: { type: 'talk_npc', npcId: 'npc_knight', target: 1, label: 'Speak with Sir Dorran' },
        intro: 'Sealed orders arrive stamped with your order\'s crest — but the parchment is five hundred years old and the officer who signed them died before your grandparents were born. "Report to the town hall garrison. The Watch resumes. The Oath was never released." Sir Dorran is the last knight of the old garrison still standing. He\'ll know if this is a prank. His face when you show him will tell you it isn\'t.',
        outro: 'Dorran reads the orders twice, then sits down like his legs were kicked out. "The Oath," he says quietly. "Officially, our order was founded to guard the roads. That\'s the lie. We were founded to guard a DOOR. Under the Wilds. And if the Watch is being recalled after five hundred years, son — something on the other side of it has started knocking."',
        xpReward: 40, goldReward: 20 },
      { id: 'k2', title: 'Proof of Steel', objective: { type: 'kill_mob', target: 6, label: 'Slay 6 of the creatures the Oath was sworn against' },
        intro: '"Before I tell you the rest, prove the recall picked the right knight," Dorran says. "The things in the dark — the Wilds after sundown, the town edge at night — those are what leaks through when the door under the Wilds breathes. Six of them. Come back with the smell of the enemy on your blade."',
        outro: 'You return and Dorran inspects your blade without a word, nodding at the black residue only a knight of the Watch would recognize. "Hollow-rot. Same as the chronicles describe. Five hundred years and it still dies the same way. Good. Now — the archive. There\'s a page the order hid even from itself."',
        xpReward: 80, goldReward: 40 },
      { id: 'k3', title: 'The Archive Lies', objective: { type: 'visit_room', room: 'library', target: 1, label: 'Search the Library for the hidden page' },
        intro: 'The order\'s official chronicle sits in the town library — polished, heroic, and false. Dorran says the true account is bound INTO the book: a confession page, hidden under the endpaper by the last honest quartermaster. Find it. Read what your order actually swore.',
        outro: 'The page is exactly where he said. The confession is short: "We did not defeat the Hollow. We could not. We sealed it with the witches\' ritual and swore the Watch until the seal fails. We told the town we won. Forgive us. It was easier for them to sleep." Beneath, a single line in fresher ink: "It is failing. — H."',
        xpReward: 60, goldReward: 30 },
      { id: 'k4', title: 'Drills at Dusk', objective: { type: 'cast_ability', target: 8, label: 'Drill 8 of your knightly arts' },
        intro: '"An oath is muscle memory," Dorran says, tossing you your kit. "Smite, bash, ward, mend — eight drills before the light dies. The old Watch trained until the movements happened without them. On the night the door opens, you will not have time to think. So we make thinking unnecessary."',
        outro: 'By the eighth drill Dorran has stopped correcting you and started just watching, arms folded, looking five hundred years tired and one evening proud. "The Watch would have taken you," he says. That, you understand, is the highest compliment he owns.',
        xpReward: 100, goldReward: 50 },
      { id: 'k5', title: 'The Vault Ledger', objective: { type: 'visit_room', room: 'bank', target: 1, label: "Check the order's old deposit at the Bank" },
        intro: 'The confession page mentions a deposit: the order\'s founders left something in the town bank\'s deepest ledger, "for the knight who resumes the Watch." Five centuries of compound dust. Go to the Bank and ask what box the Oath keeps.',
        outro: 'The ledger entry is real: one item, deposited five hundred years ago, releasable only to "a knight under Oath, when the Watch resumes." Inside: not a weapon. A map — the door under the Wilds, the cave that leads to it, and a woman\'s name you now keep finding everywhere. HAZEL. In the margin: "She holds it alone. Shame us all."',
        xpReward: 100, goldReward: 60 },
      { id: 'k6', title: 'Purge the Breach', objective: { type: 'kill_mob', target: 12, label: 'Hold the line — destroy 12 Hollow creatures' },
        intro: 'The seal is weakening and the leaks are worsening — but a Watch of ONE, standing where it\'s thinnest, can push the tide back while the witch works. Twelve of the Hollow\'s creatures. Not for glory, not for the chronicle. Because five hundred years ago your order made a promise and told no one. Tonight, someone keeps it honestly.',
        outro: 'The twelfth falls as dawn comes up. Down in the cave, you\'re told, the pressure on the seal eased for the first time in a generation — Hazel felt the line HOLD. Dorran meets you at the town gate with the order\'s ancient helm in both hands. "The chronicle gets a true page tonight," he says. "The Watch stands. Wear it, Oathkeeper."',
        xpReward: 200, goldReward: 150, itemRewards: [{ itemId: 'dread_helm', qty: 1 }] }
    ]
  },
  4: {
    title: "The Road That Isn't on the Map", icon: '🛣️',
    tagline: 'Every map of Thornreach has the same smudge. It moves.',
    chapters: [
      { id: 'v1', title: 'The Unmarked Milestone', objective: { type: 'talk_npc', npcId: 'npc_patron', target: 1, label: 'Ask Old Mabel at the Cafe about the smudge' },
        intro: 'You\'ve walked more roads than anyone in this town, and you know the deep truth of maps: they lie by omission. Every chart of Thornreach ever inked has a smudge in the same place — and last night, from the lounge rooftop, you saw lantern-light moving along the smudge. Old Mabel at the tavern has drunk with every traveler for sixty years. Ask her.',
        outro: 'Mabel doesn\'t laugh. She puts down her cup, which is worse. "The Gray Road," she says. "Every wanderer asks eventually — the ones the road wants. It only shows itself to feet that never learned to stay put. My husband saw it. Walked it. Came back with silver hair and a smile I never got an explanation for. Pack food, dear."',
        xpReward: 40, goldReward: 20 },
      { id: 'v2', title: 'Provisions for a Long Walk', objective: { type: 'harvest_plant', target: 5, label: 'Gather 5 wild provisions for the Road' },
        intro: '"Rule one of the Gray Road," Mabel says, counting on her fingers: "you pay the toll in things that GREW. Coin means nothing to it — coins have never been alive. Five green things from the Wilds, picked by your own walking hands. The Road can taste the difference between bought and gathered."',
        outro: 'Five provisions in your pack, and your feet already feel it — a faint pull at the heels, west-north-west, like the world tilting one degree in a direction that isn\'t on any compass rose. The Road knows you\'re coming. It\'s had your reservation for years.',
        xpReward: 60, goldReward: 30 },
      { id: 'v3', title: 'Follow It Into the Trees', objective: { type: 'visit_room', room: 'wilds', target: 1, label: 'Follow the pull into the Wilds' },
        intro: 'The pull leads through the portal into the Wilds. Walk it the wanderer\'s way: no destination, loose knees, eyes soft. The Gray Road doesn\'t appear to people who are LOOKING for it. It appears to people who are simply walking, the way it\'s been collecting them for five hundred years.',
        outro: 'And there it is, in the corner of your eye where it lives: a gray ribbon of path between the trees that isn\'t there when you stare. It runs from the town you left… to the cave in the north-west, the one under which — every dead map agrees — there is nothing at all. The smudge, you realize, was never bad ink. It was a door someone kept erasing.',
        xpReward: 60, goldReward: 30 },
      { id: 'v4', title: 'Tricks of the Road', objective: { type: 'cast_ability', target: 8, label: 'Use 8 of your wanderer skills' },
        intro: 'The Gray Road tests its walkers — old travelers\' stories agree on that much. Spyglass, sleight, wanderlust, the nightwatch cloak: eight workings of your trade, until your kit sits on you like weather. The Road accepts professionals. Tourists it returns, gently, to wherever they started, minus their sense of direction.',
        outro: 'Somewhere around the eighth trick you notice the Road has stopped flickering at the edge of your vision and started simply BEING there, patient as a dog that\'s decided you\'re its person. You\'re not following it anymore. You\'re walking together.',
        xpReward: 80, goldReward: 40 },
      { id: 'v5', title: 'What Walks It at Night', objective: { type: 'kill_mob', target: 8, label: 'Clear 8 of the things squatting on the Road' },
        intro: 'The Gray Road has a squatter problem: the Hollow\'s creatures cluster on it after dark, drawn to the old power in its stones. That\'s why it hides. Clear eight of them off its length — the Wilds at night, the town edge, wherever the dark things gather — and the Road will owe you, and the Road famously always, ALWAYS pays its debts.',
        outro: 'Eight down. The Road brightens visibly with each one, like a window being wiped. As the last creature dissolves, the gray ribbon does something no map could survive: it turns, politely, and points — straight at the cave mouth. An invitation. The final one.',
        xpReward: 100, goldReward: 60 },
      { id: 'v6', title: "The Road's End", objective: { type: 'visit_room', room: 'witch_cave', target: 1, label: 'Walk the Gray Road to its end — the cave' },
        intro: 'Every road ends at a door. The Gray Road was built — you understand now — as the Circle\'s escape route, the path their fifth ritualist walked DOWN five hundred years ago and never walked back up. It stays hidden because she asked it to. Walk it to the end. Meet the woman the maps kept erasing.',
        outro: 'Hazel is waiting at the bottom like she heard your boots a mile off. "The Road only brings me two kinds of visitor," she says. "Trouble, and couriers. You\'ve got courier feet." She presses something onto your boots — treads that shimmer like the Road itself. "It chose you as its keeper. Walk it often; roads die of loneliness. And wanderer — the smudge stays between us."',
        xpReward: 200, goldReward: 150, itemRewards: [{ itemId: 'soul_treads', qty: 1 }] }
    ]
  }
};

const CHAPTER_LEVEL_GATES = [1, 2, 3, 4, 6, 8];

module.exports = { QUEST_CATALOG, STORYLINES, CHAPTER_LEVEL_GATES };
