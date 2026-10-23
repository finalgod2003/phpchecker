import { makeReport, normalizeVersion } from './checker.js';

const $ = selector => document.querySelector(selector);
const form = $('#checker-form');
if (form) {
  let mode = 'url', report = null;
  const input = $('#check-input');
  const submit = $('#submit-check');
  const error = $('#form-error');
  const result = $('#result');
  const empty = $('#empty-result');
  const title = $('#result-title');
  const description = $('#result-description');
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  function switchMode(next, focus = false) {
    mode = next;
    tabs.forEach(tab => { tab.setAttribute('aria-selected', String(tab.dataset.mode === mode)); tab.tabIndex = tab.dataset.mode === mode ? 0 : -1; });
    $('#input-label').textContent = mode === 'url' ? 'Website URL' : 'PHP version';
    input.value = '';
    input.placeholder = mode === 'url' ? 'https://your-website.com' : 'e.g. 8.4.27';
    input.inputMode = mode === 'url' ? 'url' : 'text';
    input.maxLength = mode === 'url' ? 2048 : 80;
    $('#input-symbol').textContent = mode === 'url' ? '↗' : '#';
    $('#input-help').textContent = mode === 'url'
      ? 'Public HTTP or HTTPS websites · 10-second timeout · No signup'
      : 'Enter a full version (major.minor.patch) · Checked in your browser';
    submit.querySelector('span').textContent = mode === 'url' ? 'Check PHP version' : 'Check this version';
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    result.hidden = true;
    empty.hidden = false;
    if (focus) input.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode, true));
    tab.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : tabs[(index + 1) % tabs.length];
        switchMode(next.dataset.mode);
        next.focus();
      }
    });
  });

  const titles = { ok: 'This version meets the patch threshold.', potentially_vulnerable: 'This version may need an update.', unknown: 'The PHP version could not be confirmed.' };
  const labels = { ok: 'Meets threshold', potentially_vulnerable: 'Potentially vulnerable', unknown: 'Unknown' };
  function render(data) {
    report = data;
    const status = data.patch_status;
    result.dataset.status = status;
    $('#result-icon').textContent = status === 'ok' ? '✓' : status === 'potentially_vulnerable' ? '!' : '?';
    title.textContent = titles[status];
    $('#php-version').textContent = data.php_version || 'Not exposed';
    $('#patch-status').textContent = labels[status];
    $('#check-method').textContent = data.mode === 'url' ? data.responses.map(item => item.method).join(' → ') : 'Manual input';
    $('#result-target').textContent = data.mode === 'url' ? data.target : `Manually entered PHP ${data.php_version}`;
    if (status === 'ok') description.textContent = 'The reported version is at or above the PHP2Shell fix for this branch. This does not verify the installed build or rule out other vulnerabilities.';
    else if (status === 'potentially_vulnerable') description.textContent = data.fixed_in
      ? `The upstream fix for this branch starts at PHP ${data.fixed_in}. Check your hosting provider’s patched package or update to a supported release. Vendor backports may already include the fix.`
      : 'The upstream checker flags this older PHP branch. Ask your hosting provider about a backported fix, or upgrade to a supported PHP release.';
    else if (!data.php_version) description.textContent = data.redirected
      ? 'The server returned a redirect without a PHP version. Redirects are not followed. Enter the final destination URL, or check the version in your hosting panel.'
      : data.blocked ? 'The website refused or rate-limited the request. This does not tell us whether PHP is installed. Try the version from your hosting panel.'
        : 'No PHP version was found in the public Server or X-Powered-By headers. The site may hide it, use a proxy, or run another language. Try your hosting panel or php -v.';
    else description.textContent = 'This is a prerelease, incomplete version, or a branch outside the upstream rules. Use a full stable version and confirm support with your PHP vendor.';
    const evidence = $('#header-evidence');
    evidence.hidden = data.mode !== 'url';
    $('#header-lines').replaceChildren();
    if (data.responses) for (const response of data.responses) {
      const pre = document.createElement('pre');
      pre.textContent = `${response.method} · HTTP ${response.status}\nServer: ${response.server || '(not exposed)'}\nX-Powered-By: ${response.x_powered_by || '(not exposed)'}`;
      $('#header-lines').append(pre);
    }
    $('#checked-time').textContent = `Checked ${new Date(data.checked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Rules: Oct 21, 2026`;
    empty.hidden = true;
    result.hidden = false;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    error.hidden = true;
    input.removeAttribute('aria-invalid');
    const value = input.value.trim();
    if (!value) { input.focus(); return; }
    submit.disabled = true;
    tabs.forEach(tab => { tab.disabled = true; });
    document.querySelectorAll('[data-example]').forEach(button => { button.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    const buttonLabel = submit.querySelector('span').textContent;
    submit.querySelector('span').textContent = mode === 'url' ? 'Checking headers…' : 'Checking version…';
    $('#form-status').textContent = mode === 'url' ? 'Reading public response headers. This can take up to 10 seconds.' : 'Checking your version.';
    try {
      if (mode === 'version') {
        const version = normalizeVersion(value);
        if (!/^\d+\.\d+\.\d+[^\s]{0,60}$/.test(version)) throw new Error('Enter a full PHP version, such as 8.4.27 or 8.4.27-1ubuntu1.');
        render(makeReport(version, { mode: 'version' }));
      } else {
        const response = await fetch('/api/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }), signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The check could not be completed. Please try again.');
        render(data);
      }
      $('#form-status').textContent = title.textContent;
    } catch (exception) {
      error.textContent = ['TimeoutError', 'AbortError'].includes(exception.name)
        ? 'The request timed out. Try again or use the Enter a version tab.'
        : exception instanceof TypeError ? 'The checker could not connect. Check your connection and try again.' : exception.message;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      result.hidden = true;
      empty.hidden = false;
      $('#form-status').textContent = error.textContent;
    } finally {
      submit.disabled = false;
      tabs.forEach(tab => { tab.disabled = false; });
      document.querySelectorAll('[data-example]').forEach(button => { button.disabled = false; });
      form.removeAttribute('aria-busy');
      submit.querySelector('span').textContent = buttonLabel;
    }
  });

  document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
    switchMode('version');
    input.value = button.dataset.example;
    form.requestSubmit();
  }));
  $('#copy-result').addEventListener('click', async event => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(JSON.stringify(report, null, 2)); button.textContent = 'Copied ✓'; }
    catch { button.textContent = 'Copy unavailable'; }
    setTimeout(() => { button.textContent = 'Copy JSON'; }, 1800);
  });
  $('#download-result').addEventListener('click', () => {
    const href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = href; link.download = 'php-version-report.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  });
}

document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = 'Copied ✓'; }
  catch { button.textContent = 'Select and copy the command'; }
  setTimeout(() => { button.textContent = 'Copy'; }, 1800);
}));
