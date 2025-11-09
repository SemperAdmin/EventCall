/* Node runner to execute browser-based tests via Puppeteer */
const { spawn } = require('child_process');
const path = require('path');
const httpPort = process.env.PORT || '8080';

async function run() {
  const server = spawn('http-server', ['-p', httpPort], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true
  });

  const delay = ms => new Promise(r => setTimeout(r, ms));
  await delay(1000); // give server time to start

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const url = `http://localhost:${httpPort}/tests/test-runner.html`;
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Wait for window.MOCHA_DONE
  const maxWaitMs = 60000;
  const start = Date.now();
  while (true) {
    const done = await page.evaluate(() => !!window.MOCHA_DONE);
    if (done) break;
    if (Date.now() - start > maxWaitMs) {
      console.error('Timed out waiting for tests to complete');
      await browser.close();
      server.kill();
      process.exit(1);
    }
    await delay(250);
  }

  const results = await page.evaluate(() => window.__TEST_RESULTS__);
  console.log('Results:', JSON.stringify(results, null, 2));

  const failures = (results && results.stats && results.stats.failures) || 0;
  await browser.close();
  server.kill();
  if (failures > 0) {
    console.error(`Tests failed: ${failures}`);
    process.exit(1);
  }
  console.log('All tests passed');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
