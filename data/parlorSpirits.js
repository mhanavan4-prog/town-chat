// The Midnight Vigil (roadmap #6, room four — the Phantom Parlor). Unlike the
// Library/Café daily collectibles, this one is a night-gated EVENT: the spirits
// only stir after dark. Each in-game night (seeded by the day/night cycle index,
// not the UTC day) one of the Parlor's departed is restless and will speak to
// whoever sits the vigil. Hear a spirit for the first time and it's logged to
// your Vigil Register; hear all of them and earn "Keeper of the Midnight Vigil."
//
// The ids and names line up with the portrait gallery already on the Parlor
// walls (client/furniture.js) and the Widow's Watch lore node — so the vigil
// gives those painted faces a voice. Rotation is nightIndex % length; hearings
// are keyed by id, so adding spirits lengthens the cycle without disturbing logs.

const PARLOR_SPIRITS = [
  {
    id: 'lady_mirthwood',
    name: 'Lady Mirthwood',
    epitaph: 'departed 1802',
    message: 'The planchette drifts to her portrait first. "Two centuries and still no one has returned my good scissors. I shall wait. I am very good at waiting now." The temperature drops a polite degree and lifts again.'
  },
  {
    id: 'grey_earl',
    name: 'The Grey Earl',
    epitaph: 'never left',
    message: 'A chill settles into the chair beside you, unmistakably sitting. "I did not die here. I simply declined to leave. There is a difference, and I have had a long time to consider it." The candle leans toward the empty seat.'
  },
  {
    id: 'sister_opaline',
    name: 'Sister Opaline',
    epitaph: 'still humming',
    message: 'A tune you almost recognise threads the dark, hummed just behind your ear. "I never learned the words. Only the shape of it. If you hum it back, I will know you heard me." The melody waits, patient, for an answer you cannot quite give.'
  },
  {
    id: 'master_holloway',
    name: 'Master Holloway',
    epitaph: 'plays at midnight',
    message: 'Somewhere a piano that is not in this room plays three soft notes and stops. "They moved the instrument. They did not move the music. Midnight is when I practise. You are early, but you may stay." The bell on the shelf trembles once.'
  },
  {
    id: 'the_twins',
    name: 'The Twins',
    epitaph: 'they keep the watch',
    message: 'Two small voices answer as one, a half-beat apart. "We take turns. One sleeps, one watches, and we never tell which is which. You looked up just now — good. That is how you keep the watch too." Something small laughs, twice, in two places.'
  },
  {
    id: 'unknown_guest',
    name: 'The Unknown Guest',
    epitaph: 'checked in forever',
    message: 'The register in the hall, long empty, seems heavier for a moment. "I have forgotten my name, my face, the year. I remember only that the Parlor took me in on a cold night and never asked me to go. Neither should you, when your night comes." The draught smells faintly of rain.'
  },
  {
    id: 'the_widow',
    name: 'The Widow',
    epitaph: 'she keeps the watch',
    message: 'The boards overhead answer a slow, pacing step — heel, toe, heel — and stop where the old rail used to be. "He will come by the north road or he will not come at all. I have decided to be here either way. It is not sad. It is simply the watch." She resumes her pacing, unhurried.'
  },
  {
    id: 'captain_vane',
    name: 'Captain Vane',
    epitaph: 'lost at moonrise',
    message: 'The green glyphs on the walls sway as if underwater. "Moonrise took my ship and most of my crew and all of my pride. I kept the heading out of habit. If you are ever lost at sea, steer by the thing you refuse to let go of. It is as good as any star." Salt water beads on the cold glass of the relic case.'
  }
];

module.exports = { PARLOR_SPIRITS };
