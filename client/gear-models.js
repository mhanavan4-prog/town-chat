// Worn gear that has a model of its own (public/kk/gear/<itemId>.glb, tools/models/build_gear.py). An item
// not listed here is drawn the old way, as its slot's plain shape in the item's colour.
// test/gear-models.test.js holds this list to the files and to the catalogue.
export const GEAR_IDS = [
  'iron_sword', 'spell_tome', 'yew_wand', 'cursed_blade', 'shadow_staff', 'void_staff', 'alpha_fang', 'wizard_hat', 'bloodmoon_circlet', 'beast_crown', 'spirit_veil', 'knights_helm', 'travelers_hood', 'dread_helm', 'shadow_crown', 'steel_shield', 'witch_robe', 'beast_hide', 'spirit_robe', 'travelers_vest', 'bone_armor', 'shadow_cloak', 'abyssal_armor', 'moonhowl_pelt', 'leather_boots', 'hexed_boots', 'paw_boots', 'soul_treads', 'wraith_treads', 'nightfang_boots', 'silver_ring', 'hex_amulet', 'spirit_ring', 'order_signet', 'trail_ring', 'witches_boon', 'death_ring', 'packbound_ring',
];
// The legendaries (data/legendaryCatalog.js): a model each as well, fetched when first seen worn.
export const LEGEND_GEAR_IDS = [
  // weapons
  'lg_thornreach_fang', 'lg_lantern_saber', 'lg_bogiron_cleaver', 'lg_vesper_rod', 'lg_pallbearer_maul', 'lg_hedgewitch_switch', 'lg_ratcatcher_pike', 'lg_candlewax_kris', 'lg_gravewind_scythe', 'lg_stormcall_wand', 'lg_moonlit_rapier', 'lg_covenfire_staff', 'lg_briarheart_bow', 'lg_howlback_axe', 'lg_riddlebone_cane', 'lg_eclipse_blade', 'lg_wispfire_scepter', 'lg_thornqueen_glaive', 'lg_severance_shard', 'lg_first_lantern',
  // heads
  'lg_owlfeather_hood', 'lg_stargazer_circlet', 'lg_mourning_veil', 'lg_hearthkeeper_bonnet', 'lg_toadstool_cap', 'lg_ferryman_tricorn', 'lg_candlecrown', 'lg_briar_diadem', 'lg_frostwarden_helm', 'lg_augur_blindfold', 'lg_swarm_keeper_net', 'lg_wolfmoon_casque', 'lg_pumpkin_regalia', 'lg_silence_cowl', 'lg_comet_chaplet', 'lg_deepwood_antlers', 'lg_midnight_mitre', 'lg_banshee_garland', 'lg_crown_of_hollows', 'lg_auditor_plume',
  // chests
  'lg_thornwood_brigandine', 'lg_festival_doublet', 'lg_bogshroud', 'lg_beekeeper_habit', 'lg_gravedigger_coat', 'lg_stormcloak', 'lg_patchwork_wards', 'lg_ashen_apron', 'lg_moonsilk_mantle', 'lg_ironbark_cuirass', 'lg_wisplight_robe', 'lg_howlhide_mantle', 'lg_vaultkeeper_vest', 'lg_corvid_feathercoat', 'lg_emberforged_plate', 'lg_tidebound_scale', 'lg_starfall_chasuble', 'lg_shroud_of_names', 'lg_severance_raiment', 'lg_dawnkeeper_aegis',
  // feet
  'lg_cobblestep_boots', 'lg_mudlark_waders', 'lg_dancing_slippers', 'lg_lamplighter_treads', 'lg_thistledown_socks', 'lg_gravel_ghost_shoes', 'lg_ratline_climbers', 'lg_fernwalkers', 'lg_frostgait_boots', 'lg_wakewalkers', 'lg_howlrunner_paws', 'lg_vesper_stalkers', 'lg_emberstride_greaves', 'lg_gallows_hoppers', 'lg_starstride_sandals', 'lg_shadowmoss_treads', 'lg_briarleap_boots', 'lg_moonshod_greaves', 'lg_severance_striders', 'lg_dawnchaser_boots',
  // rings
  'lg_moonstone_signet', 'lg_toll_ring', 'lg_thornprick_band', 'lg_hearthstone_loop', 'lg_bogpearl_ring', 'lg_whisperknot_band', 'lg_acorn_promise', 'lg_candlekeeper_band', 'lg_stormglass_ring', 'lg_gravekeeper_seal', 'lg_foxfire_loop', 'lg_midnight_meridian', 'lg_wolfpact_band', 'lg_beetlewing_ring', 'lg_sirens_knuckle', 'lg_leyline_coil', 'lg_reliquary_ring', 'lg_thirteenth_candle', 'lg_auditor_ledgerband', 'lg_severance_orbit',
];
// Where a model sits on a KayKit body, per slot: the bone's own space is not the model's, so each slot has a
// turn (radians, XYZ) and an offset (game units) found by eye in the real client. A model is built at 1 unit =
// 10 game units.
export const GEAR_SCALE = 10;
export const GEAR_SEAT = {
  weapon: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.25 },
  // a head differs by class (the Knight's hair stands high, the Necromancer's is a bare skull): y and scale by charId
  head: { pos: [0, 15.4, 0], rot: [0, 0, 0], scale: 1.46, byChar: { 0: { y: 15.4 }, 1: { y: 16.1 }, 2: { y: 19.4, scale: 1.62 }, 3: { y: 19.6, scale: 1.58 }, 4: { y: 16.6 }, 5: { y: 17.4, scale: 1.3 } } },
  chest: { pos: [0, -3, 0], rot: [0, 0, 0], scale: 1.4 },
  feet: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.5, body: true },   // body: square to the body, not to the bone
  ring: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1.4 },
};
