/**
 * Open URLs in the user's system Chrome / Edge (not Electron's BrowserWindow).
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { shell } = require('electron');

function windowsBrowserCandidates() {
  const local = process.env.LOCALAPPDATA || '';
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  return [
    { name: 'Chrome', exe: path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'), page: 'chrome://extensions' },
    { name: 'Chrome', exe: path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), page: 'chrome://extensions' },
    { name: 'Chrome', exe: path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), page: 'chrome://extensions' },
    { name: 'Edge', exe: path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), page: 'edge://extensions' },
    { name: 'Edge', exe: path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), page: 'edge://extensions' },
  ];
}

function macBrowserCandidates() {
  return [
    { name: 'Chrome', exe: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', page: 'chrome://extensions' },
    { name: 'Chrome', exe: path.join(process.env.HOME || '', 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'), page: 'chrome://extensions' },
    { name: 'Edge', exe: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', page: 'edge://extensions' },
  ];
}

function linuxBrowserCandidates() {
  return [
    { name: 'Chrome', exe: 'google-chrome', page: 'chrome://extensions' },
    { name: 'Chrome', exe: 'google-chrome-stable', page: 'chrome://extensions' },
    { name: 'Chromium', exe: 'chromium', page: 'chrome://extensions' },
    { name: 'Chromium', exe: 'chromium-browser', page: 'chrome://extensions' },
    { name: 'Edge', exe: 'microsoft-edge', page: 'edge://extensions' },
  ];
}

function findBrowser() {
  const list =
    process.platform === 'win32'
      ? windowsBrowserCandidates()
      : process.platform === 'darwin'
        ? macBrowserCandidates()
        : linuxBrowserCandidates();

  for (const c of list) {
    if (c.exe.includes(path.sep) || c.exe.includes('/')) {
      if (fs.existsSync(c.exe)) return c;
    } else {
      // PATH binary — try spawning which via shell open later
      return c;
    }
  }
  return null;
}

function openInBrowser(url) {
  const browser = findBrowser();
  if (browser && (browser.exe.includes(path.sep) || browser.exe.includes('/')) && fs.existsSync(browser.exe)) {
    spawn(browser.exe, [url], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, browser: browser.name };
  }
  // Linux PATH browsers or fallback
  if (browser && process.platform === 'linux') {
    try {
      spawn(browser.exe, [url], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, browser: browser.name };
    } catch {
      /* fall through */
    }
  }
  shell.openExternal(url);
  return { ok: true, browser: 'default' };
}

function openExtensionsPage() {
  const browser = findBrowser();
  if (!browser) {
    shell.openExternal('https://www.google.com/chrome/');
    return { ok: false, error: 'no-browser', browser: null };
  }
  if ((browser.exe.includes(path.sep) || browser.exe.includes('/')) && fs.existsSync(browser.exe)) {
    spawn(browser.exe, [browser.page], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, browser: browser.name, page: browser.page };
  }
  if (process.platform === 'linux') {
    try {
      spawn(browser.exe, [browser.page], { detached: true, stdio: 'ignore' }).unref();
      return { ok: true, browser: browser.name, page: browser.page };
    } catch {
      /* fall through */
    }
  }
  shell.openExternal(browser.page);
  return { ok: true, browser: browser.name, page: browser.page };
}

module.exports = { findBrowser, openInBrowser, openExtensionsPage };
