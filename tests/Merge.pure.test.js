const { getManuallyAddedMembers_ } = require('../apps_script_project/Merge.gs');

describe('getManuallyAddedMembers_', () => {
  test('should return an empty array when there are no new members', () => {
    const sheetMembers = new Set(['user1@example.com', 'user2@example.com']);
    const groupMembers = new Set(['user1@example.com', 'user2@example.com']);
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);
    expect(manuallyAddedMembers).toEqual([]);
  });

  test('should return the new members when there are new members', () => {
    const sheetMembers = new Set(['user1@example.com']);
    const groupMembers = new Set(['user1@example.com', 'user2@example.com']);
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);
    expect(manuallyAddedMembers).toEqual(['user2@example.com']);
  });

  test('should return all group members when the sheet is empty', () => {
    const sheetMembers = new Set();
    const groupMembers = new Set(['user1@example.com', 'user2@example.com']);
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);
    expect(manuallyAddedMembers).toEqual(['user1@example.com', 'user2@example.com']);
  });

  test('should return an empty array when the group is empty', () => {
    const sheetMembers = new Set(['user1@example.com', 'user2@example.com']);
    const groupMembers = new Set();
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);
    expect(manuallyAddedMembers).toEqual([]);
  });

  test('should return an empty array when both the sheet and the group are empty', () => {
    const sheetMembers = new Set();
    const groupMembers = new Set();
    const manuallyAddedMembers = getManuallyAddedMembers_(sheetMembers, groupMembers);
    expect(manuallyAddedMembers).toEqual([]);
  });
});
