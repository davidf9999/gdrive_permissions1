const globals = require('globals');
const js = require('@eslint/js');
const googleAppsScriptPlugin = require('eslint-plugin-googleappsscript');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  {
    // Global ignores
    ignores: [
      'node_modules/',
      'tests/',
      '.clasp.json',
      '*.json',
      '*.sh',
      '.github/'
    ],
  },
  {
    // Configuration for Apps Script files
    files: ['apps_script_project/**/*.js', 'apps_script_project/**/*.gs'],
    // Apply configurations
    ...js.configs.recommended,
    ...googleAppsScriptPlugin.configs.recommended,
    ...prettierConfig,
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
