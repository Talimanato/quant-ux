module.exports = {
  testPathIgnorePatterns: [
    '/node_modules/',
    '/backend/'
  ],
  //preset: '@vue/cli-plugin-unit-jest',
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
    '^src/(.*)$': '<rootDir>/src/$1',
    '^assets/(.*)$': '<rootDir>/src/assets/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^dojo/(.*)$': '<rootDir>/src/dojo/$1',
    '^common/(.*)$': '<rootDir>/src/common/$1',
    '^vommond/(.*)$': '<rootDir>/src/vommond/$1',
    '^views/(.*)$': '<rootDir>/src/views/$1',
    '^canvas/(.*)$': '<rootDir>/src/canvas/$1',
    '^page/(.*)$': '<rootDir>/src/page/$1',
    '^user/(.*)$': '<rootDir>/src/user/$1',
    '^core/(.*)$': '<rootDir>/src/core/$1',
    '^dash/(.*)$': '<rootDir>/src/dash/$1',
    '^public/(.*)$': '<rootDir>/src/public/$1',
    '^services/(.*)$': '<rootDir>/src/services/$1',
    '^nls/(.*)$': '<rootDir>/src/nls/$1',
    '^themes/(.*)$': '<rootDir>/src/themes/$1',
    '^export/(.*)$': '<rootDir>/src/export/$1',
    '^examples/(.*)$': '<rootDir>/src/examples/$1',
    '^help/(.*)$': '<rootDir>/src/help/$1',
    '^player/(.*)$': '<rootDir>/src/player/$1',
    '^style/(.*)$': '<rootDir>/src/style/$1'
  },
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.js$': 'babel-jest'
  }
}
