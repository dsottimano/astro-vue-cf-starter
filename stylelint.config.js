/** Lints plain CSS (src/styles/*.css). SFC/Astro scoped styles are skipped to
 *  avoid pulling in a postcss-html parser — keep the toolchain lean. */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Allow Tailwind v4 CSS-first at-rules.
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'theme',
          'tailwind',
          'apply',
          'utility',
          'variant',
          'custom-variant',
          'source',
        ],
      },
    ],
    'import-notation': null,
    // @theme inline intentionally maps tokens to same-named vars.
    'custom-property-no-missing-var-function': null,
  },
};
