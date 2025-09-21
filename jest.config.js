module.exports = {
  setupFilesAfterEnv: ['./tests/setup.js'],
  // Load script files to make their functions available globally in tests
  setupFiles: [
    '<rootDir>/apps_script_project/Core.gs',
    '<rootDir>/apps_script_project/Utils.gs'
  ],
};
