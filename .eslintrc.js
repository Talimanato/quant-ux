module.exports = {
  root: true,
  ignorePatterns: ['backend/**', 'dist/**', 'node_modules/**'],
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  parserOptions: {
    parser: 'babel-eslint'
  },
  rules: {
    'no-console': 'off',
    'no-debugger': 'off',
    'no-useless-escape': 'off',
    'no-mixed-spaces-and-tabs': 'off',
    'no-async-promise-executor': 'off',
    'no-prototype-builtins': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-mutating-props': 'off',
    // Temporarily relaxed during Vue 2 -> Vue 3 compat migration
    'no-unused-vars': 'warn',
    'no-undef': 'warn'
  },
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)',
        'tests/unit/**/*.js'
      ],
      env: {
        jest: true
      },
      rules: {
        'no-unused-vars': 'off',
        'no-undef': 'off'
      }
    }
  ]
}
