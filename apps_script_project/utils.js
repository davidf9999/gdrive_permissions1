function generateGroupEmail(baseName, domain) {
  const domainToUse = domain || Session.getActiveUser().getEmail().split('@')[1];
  if (!domainToUse) {
    throw new Error('Could not determine user domain.');
  }
  const sanitizedName = baseName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return sanitizedName + '@' + domainToUse;
}

if (typeof module !== 'undefined') {
  module.exports = { generateGroupEmail };
}
