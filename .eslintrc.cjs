module.exports = {
  root: true,
  env: { es2021: true, node: true, browser: true },
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  extends: ['eslint:recommended', 'plugin:import/recommended', 'prettier'],
  settings: { 'import/resolver': { typescript: true } },
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/no-unresolved': 'off'
  },
};

