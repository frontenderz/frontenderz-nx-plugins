// Set the required Node.js option for ES Module support in Jest
process.env.NODE_OPTIONS = '--experimental-vm-modules';

const nxPreset = require('@nx/jest/preset').default;

module.exports = { ...nxPreset };
