module.exports = {
  configureYulOptimizer: true,
  skipFiles: ["mocks", "root", "common"],
  testFiles: "test/child/*.ts",
};
