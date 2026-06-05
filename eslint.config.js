import js from '@eslint/js';
import ts from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import vue from 'eslint-plugin-vue';

export default ts.config(
  { ignores: ['dist/', '.astro/', 'node_modules/'] },

  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/essential'],
  ...astro.configs.recommended,
  // NOTE: static jsx-a11y rules are omitted — eslint-plugin-jsx-a11y doesn't
  // yet support ESLint 10. Accessibility is gated by html-validate + axe
  // (pa11y-ci) in CI instead.

  // TypeScript/SFC/Astro files: the compiler owns undefined-symbol checking,
  // so the lexical no-undef rule (from js.recommended) only gets in the way.
  {
    files: ['**/*.{ts,vue,astro}'],
    rules: { 'no-undef': 'off' },
  },

  // <script lang="ts"> inside .vue needs the TS parser.
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },

  // Node CLI scripts: provide the runtime globals they rely on.
  {
    files: ['cli/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },

  // Admin view/page components are routed by name — single words are fine.
  {
    files: ['src/admin/views/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
);
