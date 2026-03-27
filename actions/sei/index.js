const core = require('./core');
const frames = require('./frames');
const seiProcess = require('./process');
const seiDocument = require('./document');
const editor = require('./editor');
const auth = require('./auth');

module.exports = {
  ...core,
  ...frames,
  ...seiProcess,
  ...seiDocument,
  ...editor,
  ...auth
};
