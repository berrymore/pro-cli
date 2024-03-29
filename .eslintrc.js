module.exports = {
  root: true,
  env: {
    node: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'airbnb-typescript/base'
  ],
  rules: {
    'import/prefer-default-export': 'off',
    'no-restricted-syntax': ['off', 'ForOfStatement'],
    'no-console': ['off'],
    'max-len': ['error', 120]
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'bin',
    '.eslintrc.js'
  ]
};
