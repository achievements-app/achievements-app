/* eslint-disable */
export default {
  displayName: "api",
  preset: "../../jest.preset.js",
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.spec.json"
    }
  },
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": "ts-jest"
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "../../coverage/apps/api",
  coverageReporters: ["text"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/index.ts",
    "!src/**/*.model.ts",
    "!src/**/*Mocks.ts"
  ],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"]
};
