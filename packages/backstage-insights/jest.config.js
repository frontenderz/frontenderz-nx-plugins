/* eslint-disable */
module.exports = {
  displayName: 'backstage-insights',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/packages/backstage-insights',
  testEnvironment: 'node',
};
