const assert = require('assert');
const { generateGroupEmail } = require('../apps_script_project/utils.js');

describe('generateGroupEmail', () => {
  it('sanitizes name and appends domain', () => {
    const result = generateGroupEmail('My Group Name', 'example.com');
    assert.strictEqual(result, 'my-group-name@example.com');
  });

  it('throws if domain missing and Session not provided', () => {
    let error;
    try {
      generateGroupEmail('Test');
    } catch (e) {
      error = e;
    }
    assert.ok(error instanceof Error);
  });
});

// Minimal test runner
function describe(name, fn) {
  console.log(name);
  fn();
}
function it(name, fn) {
  try {
    fn();
    console.log('  \u2714', name);
  } catch (err) {
    console.log('  \u2716', name);
    console.error(err);
    process.exitCode = 1;
  }
}
