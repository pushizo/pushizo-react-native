/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/plugin/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json', diagnostics: { ignoreCodes: ['TS151002'] } }],
  },
  // TS API testleri gerçek react-native yerine sahte native modül kullanır.
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__tests__/support/reactNativeMock.ts',
  },
  clearMocks: true,
};
