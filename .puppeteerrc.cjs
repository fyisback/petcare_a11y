// puppeteer.config.cjs
const { join } = require('path');

/**
 * @type {import('puppeteer').Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to a directory that Render will preserve.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
