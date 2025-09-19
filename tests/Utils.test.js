const fs = require('fs');
const path = require('path');

// Load the script file to make its functions available to the test
const utilsPath = path.resolve(__dirname, '../apps_script_project/Utils.gs');
const utilsCode = fs.readFileSync(utilsPath, 'utf8');
eval(utilsCode);

describe('generateGroupEmail_', () => {
  // Save the original implementation of the mock from setup.js
  const originalGetActiveUser = Session.getActiveUser;

  afterEach(() => {
    // After each test, restore the original mock to ensure test isolation
    Session.getActiveUser = originalGetActiveUser;
  });

  it('should generate a correct group email from a simple name', () => {
    const baseName = 'My Project Editors';
    const expectedEmail = 'my-project-editors@example.com';

    // This test will use the default mock defined in `tests/setup.js`
    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle special characters and sanitize the name', () => {
    const baseName = 'Project X (Devs) & QA!';
    const expectedEmail = 'project-x-devs--qa@example.com';

    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle different domains', () => {
    // Override the mock implementation for this test only
    Session.getActiveUser = jest.fn(() => ({
      getEmail: () => 'admin@my-company.org',
    }));

    const baseName = 'Test Folder';
    const expectedEmail = 'test-folder@my-company.org';

    const actualEmail = generateGroupEmail_(baseName);

    expect(actualEmail).toBe(expectedEmail);
  });

  it('should handle names that are already lowercase and sanitized', () => {
    // The afterEach hook will have restored the default mock
    const baseName = 'already-sanitized';
    const expectedEmail = 'already-sanitized@example.com';
    const actualEmail = generateGroupEmail_(baseName);
    expect(actualEmail).toBe(expectedEmail);
  });
});
