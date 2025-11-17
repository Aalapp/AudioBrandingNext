// jest.config.js
const { createDefaultPreset, pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig");

const tsJestTransformCfg = createDefaultPreset().transform;

const tsMapper = pathsToModuleNameMapper(compilerOptions?.paths || {}, {
  prefix: "<rootDir>/",
});

const moduleNameMapper = {
  "^@/(.*)$": "<rootDir>/src/$1",
  ...tsMapper,
};

// Print mapping for debug
console.log("Jest moduleNameMapper:", moduleNameMapper);

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  // Allow transforming nanoid and jose (or other ESM libs) by NOT ignoring them
  // This pattern ignores node_modules except nanoid and jose. Add more packages to the lookahead if needed.
  transformIgnorePatterns: ["/node_modules/(?!(nanoid|jose)/)"],
  moduleNameMapper,
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleDirectories: ["node_modules", "<rootDir>/src", "<rootDir>"],
};
