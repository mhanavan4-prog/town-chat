'use strict';
// The Ember Wastes' ash storms (data/emberStorm.js): calm, then the wind
// getting up, then the storm, then calm again. Everyone in the Wastes is told
// at each turn; whoever was out there when it broke and is still out there
// when it drops has weathered it.
const { STORM, STORM_LORE } = require('../data/emberStorm');

module.exports = function createEmberStorm({ now = () => Date.now(), rand = Math.random, tellWastes = () => {}, inWastes = () => [], onWeathered = () => {} } = {}) {
  let phase = 'calm';
  let until = now() + STORM.firstMs;
  let out = new Set();   // who was in the Wastes when the storm broke

  const payload = () => ({ type: 'ember_storm', phase, until, says: phase === 'calm' ? null : STORM.says[phase] });
  const calmFor = () => STORM.calmMinMs + Math.floor(rand() * (STORM.calmMaxMs - STORM.calmMinMs));

  function turn(next, ms, sfx) {
    phase = next; until = now() + ms;
    tellWastes({ ...payload(), sfx, turn: true });
    tellWastes({ type: 'toast', level: 'important', always: true, message: STORM.says[next] });
  }

  function tick() {
    if (now() < until) return;
    if (phase === 'calm') turn('gathering', STORM.gatherMs, 'ash_storm_rise');
    else if (phase === 'gathering') {
      out = new Set(inWastes().map((p) => p.id));
      turn('storm', STORM.blowMs);
    } else {
      const weathered = inWastes().filter((p) => out.has(p.id) && !p.isDead);
      out = new Set();
      turn('calm', calmFor(), 'ash_storm_end');
      for (const p of weathered) onWeathered(p);
    }
  }

  // Someone who dies in it, or goes back through the portal, has not weathered it.
  function leave(player) { if (player) out.delete(player.id); }

  const aggroMul = () => (phase === 'storm' ? STORM.aggroMul : 1);
  const loreBoard = () => ({ type: 'vh_board', title: '🌫️ Storms, and those who raised them', epithet: 'In the record', lines: [...STORM_LORE.lines, `Source: ${STORM_LORE.source}`, STORM_LORE.note] });

  // for tests and the moot board
  const state = () => ({ phase, until });
  function force(next, ms) { phase = next; until = now() + (ms != null ? ms : 0); if (next === 'storm') out = new Set(inWastes().map((p) => p.id)); }

  return { tick, payload, aggroMul, leave, loreBoard, state, force };
};
