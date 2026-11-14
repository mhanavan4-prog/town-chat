// After Episode III (data/quests.js chapters 10-12): what the people of the Wastes say, once each, to someone who
// has finished their class's story there. Dame Isolt at her squint; one of the folk who came back (Wat at the
// graves, Nan at the well); and for the Witch, who is waiting at the ring. All of it the game's own.
// Keyed by class (charId): 0 Witch, 1 Werewolf, 2 Mystic, 3 Knight, 4 Wanderer, 5 Necromancer.
const EPILOGUES = {
  0: {
    isolt: '"Two came out to the ring, I am told; I cannot see so far. Tell her there have been two lamps lit in here every night since the door was built up. It was in the rule the first of us was given: one for the Order, and one for the five."',
    folk: 'nan', says: '"An old woman came and sat by the well a whole afternoon and would not drink. Said she had dressed it herself once, and had forgotten how the flowers went. So I showed her. She cried, and then she told me I had the campion wrong."',
    ring: '🌿 Hazel is here before you, standing in the first of the five places with her shawl pulled round her. She does not turn. "It still fits," she says. "I was so afraid it would not."',
  },
  1: {
    isolt: '"The hounds have stopped coming to the wall at night. Nine of us have lain and listened to them. I find I miss it. Whatever you laid down out there, wolf, I think they had been waiting five hundred years for leave to stop keeping watch."',
    folk: 'wat', says: '"There is a dog lies on the long grave now. Grey one, big. Does not dig. I went to shift it and it looked at me, so I did not. I have started leaving it water."',
  },
  2: {
    isolt: '"It is quieter. I could not have told you it was loud; I only know that I sleep now. Some stayed, you say. Good. I should not have liked to keep a lamp for an empty field."',
    folk: 'wat', says: '"I was ringing for them the other night and I stopped partway, and could not have told you why. It only seemed that there were fewer left to ring for."',
  },
  3: {
    isolt: '"You watched, and you came back to tell me so. The tenth has not been chosen. I will not ask you. But I notice you keep coming to stand where I can see your boots."',
    folk: 'nan', says: '"Dame Isolt asks after you. She does not ask after anybody. I thought you ought to know."',
  },
  4: {
    isolt: '"A cart. I heard a cart yesterday on the south track, and I have not heard a wheel in this town in all my life. A road is a kind of prayer, keeper. It only works while somebody goes on saying it."',
    folk: 'nan', says: '"A stranger came through yesterday with a pack on, and asked me the way to the Bazaar as if this were any town on any road. I had to sit down."',
  },
  5: {
    isolt: '"Fifteen fewer. I count them at dusk by the sound on the cobbles, and it was fifteen fewer. I was taught to fear what you are. Nobody taught me what to say to one of you who opens the hand."',
    folk: 'wat', says: '"I will tell you what I tell nobody. I dig them deep and I say the words, and until this month I never once believed it took. Something is different in the ground. They stay."',
  },
};
const EPILOGUE_XP = 60;
const EPISODE_THREE_DONE = 12;   // chapters

module.exports = { EPILOGUES, EPILOGUE_XP, EPISODE_THREE_DONE };
