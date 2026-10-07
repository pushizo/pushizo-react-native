/** TS katmanı (yerel modül sahte) ve Expo config plugin testleri. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/plugin'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }] },
  modulePathIgnorePatterns: ['<rootDir>/lib', '<rootDir>/plugin/build'],
};
