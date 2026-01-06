(function(){
  const host = (location.hostname || '').toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (!isLocal) return;

  const results = [];
  const assert = (name, cond) => { results.push({ name, pass: !!cond }); };

  try {
    assert('formatDate empty returns empty string', window.formatDate('') === '');
    assert('formatDate invalid returns Invalid Date', window.formatDate('not-a-date') === 'Invalid Date');
    const formatted = window.formatDate('2025-12-25');
    assert('formatDate valid returns non-empty', typeof formatted === 'string' && formatted.length > 0 && formatted !== 'Invalid Date');
  } catch (e) {
    results.push({ name: 'formatDate tests threw', pass: false, error: e && e.message });
  }

  try {
    const t = window.formatTime('14:30');
    assert('formatTime formats to 12h', t.includes('PM') && t.startsWith('2:30'));
  } catch (e) {
    results.push({ name: 'formatTime tests threw', pass: false, error: e && e.message });
  }

  console.group('[EventCall Tests]');
  results.forEach(r => {
    if (r.pass) console.log('✅', r.name);
    else console.error('❌', r.name, r.error ? ('- ' + r.error) : '');
  });
  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;
  console.log(`Summary: ${passCount} passed, ${failCount} failed`);
  console.groupEnd();
})();
