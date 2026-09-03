/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier',
    'plugin:vue/recommended',
  ],
  // Plain .mjs helper scripts are parsed by espree, which defaults to an older language
  // level than they are written in — numeric separators and top-level await both fail there.
  overrides: [
    {
      files: ['**/*.mjs'],
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  ],
  rules: {
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        semi: true,
        useTabs: false,
        tabWidth: 2,
        trailingComma: 'all',
        printWidth: 80,
        bracketSpacing: true,
        arrowParens: 'avoid',
      },
    ],
    'vue/no-unused-vars': 'warn',
    'no-console': 'warn',
    'vue/multi-word-component-names': 'off',
    'no-unused-vars': 'warn',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/first-attribute-linebreak': [
      'error',
      {
        singleline: 'ignore',
        multiline: 'below',
      },
    ],
    'vue/max-attributes-per-line': 'off',
    'vue/no-mutating-props': 'off',
    'vue/no-v-model-argument': 'off',
  },
};
