const globals = require('globals');

// Bug-catching rules only — no style noise. These are the classes of defect
// that actually shipped: duplicate top-level names clobbering each other
// (no-redeclare — the buildCaveScene collision), unreachable code, dup keys,
// accidental assignment in conditions, etc. Everything here is a HARD ERROR
// because it has ~zero false positives on real code.
const bugRules = {
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-dupe-class-members': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-unreachable': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-self-assign': 'error',
  'no-unsafe-negation': 'error',
  'valid-typeof': 'error',
  'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
};

module.exports = [
  {
    ignores: [
      'node_modules/**', '_to_delete/**',
      'public/three.min.js', 'public/face-api.min.js',
      'public/GLTFLoader.js', 'public/SkeletonUtils.js', 'public/fx.js',
      'test/three-stub.js',
    ],
  },
  // Server + Node test/QA scripts (CommonJS). Node globals are well known, so
  // undefined variables here are a hard error.
  {
    files: ['server.js', 'test/**/*.js', 'test/**/*.cjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // ESM smoke/harness scripts.
  {
    files: ['test/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { ...bugRules, 'no-undef': 'error' },
  },
  // Browser client — one big global <script>. It leans on globals from bundled
  // scripts loaded before it (three.min.js -> THREE, fx.js -> FX/LEGEND_FX,
  // face-api -> faceapi). no-undef starts at 'warn' so a missed library global
  // doesn't red-wall CI on day one; whitelist anything it flags here, then flip
  // this to 'error' for a hard static gate. The undefined-variable LOAD CRASH
  // class is already caught at runtime by test/smoke.browser.mjs regardless.
  {
    files: ['public/client.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, THREE: 'readonly', faceapi: 'readonly', FX: 'readonly', LEGEND_FX: 'readonly' },
    },
    rules: { ...bugRules, 'no-undef': 'warn' },
  },
];
