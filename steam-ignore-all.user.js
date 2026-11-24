// ==UserScript==
// @version      1.0.1
// @updateURL    https://raw.githubusercontent.com/alexandre-vasc/selenium-automate/refs/heads/main/steam-ignore-all.user.js
// @downloadURL  https://raw.githubusercontent.com/alexandre-vasc/selenium-automate/refs/heads/main/steam-ignore-all.user.js
// @name         Steam: Ignore all games on page
// @namespace    https://github.com/alexandre-vasc/selenium-automate
// @version      1.0.0
// @description  Adds a button that scrolls the page to load every game, then marks each one as "Not Interested" (ignored) on Steam.
// @match        https://store.steampowered.com/curator/*
// @match        https://store.steampowered.com/developer/*
// @match        https://store.steampowered.com/publisher/*
// @match        https://store.steampowered.com/franchise/*
// @match        https://store.steampowered.com/search*
// @match        https://store.steampowered.com/category/*
// @match        https://store.steampowered.com/genre/*
// @match        https://store.steampowered.com/tags/*
// @match        https://store.steampowered.com/sale/*
// @match        https://store.steampowered.com/specials*
// @match        https://store.steampowered.com/explore/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const REQUEST_DELAY_MS = 2000;   // pause between ignore requests (be gentle with Steam)
    const SCROLL_DELAY_MS = 1000;    // wait after each scroll for lazy-loaded items
    const SCROLL_RETRIES = 2;        // extra scroll attempts with no new items before giving up
    const SNR = '1_7_7_230_150_1';

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    let running = false;
    let cancelled = false;

    // ---------- UI ----------
    const box = document.createElement('div');
    box.style.cssText = [
        'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647',
        'display:flex', 'flex-direction:column', 'align-items:flex-end', 'gap:6px',
        'font-family:"Motiva Sans",Arial,sans-serif', 'font-size:13px',
    ].join(';');

    const status = document.createElement('div');
    status.style.cssText =
        'display:none;background:#171a21;color:#c7d5e0;border:1px solid #3d4450;' +
        'padding:6px 10px;border-radius:3px;max-width:320px;';

    const btn = document.createElement('button');
    btn.textContent = '🚫 Ignore all games on this page';
    btn.style.cssText =
        'background:linear-gradient(to right,#c0392b,#962d22);color:#fff;border:none;' +
        'padding:10px 14px;border-radius:3px;cursor:pointer;font-size:13px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.5);';

    box.append(status, btn);
    document.body.appendChild(box);

    function setStatus(msg) {
        status.style.display = 'block';
        status.textContent = msg;
        console.log('[steam-ignore] ' + msg);
    }

    function setRunning(state) {
        running = state;
        btn.textContent = state ? '⏹ Stop' : '🚫 Ignore all games on this page';
    }

    btn.addEventListener('click', async () => {
        if (running) {
            cancelled = true;
            setStatus('Stopping after the current request…');
            return;
        }
        cancelled = false;
        setRunning(true);
        try {
            await ignoreSteam();
        } catch (err) {
            console.error(err);
            setStatus('Error: ' + err.message);
        } finally {
            setRunning(false);
        }
    });

    // ---------- Core logic ----------
    function collectGameElements() {
        return document.querySelectorAll('a[data-ds-appid], div[data-ds-appid]');
    }

    async function loadEverything() {
        let lastCount = 0;
        let stale = 0;

        while (stale <= SCROLL_RETRIES && !cancelled) {
            window.scrollTo(0, document.body.scrollHeight);
            await sleep(SCROLL_DELAY_MS);
            const count = collectGameElements().length;
            setStatus(`Scrolling… found ${count} games`);
            if (count > lastCount) {
                lastCount = count;
                stale = 0;
            } else {
                stale++;
            }
        }
        window.scrollTo(0, 0);
    }

    function extractIds() {
        const ids = new Set();
        let alreadyIgnored = 0;

        for (const el of collectGameElements()) {
            const raw = el.getAttribute('data-ds-appid');
            if (!raw) continue;

            if (el.querySelector('.ds_ignored_flag') || el.classList.contains('ds_ignored')) {
                alreadyIgnored++;
                continue;
            }
            // bundles can carry several comma-separated app IDs
            raw.split(',').map((s) => s.trim()).filter(Boolean).forEach((id) => ids.add(id));
        }
        return { ids, alreadyIgnored };
    }

    function getSessionId() {
        const match = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    async function ignoreSteam() {
        await loadEverything();
        if (cancelled) { setStatus('Cancelled.'); return; }

        const total = collectGameElements().length;
        if (total === 0) throw new Error('No games found on this page.');

        const { ids, alreadyIgnored } = extractIds();
        if (ids.size === 0) {
            setStatus(`Nothing to do (${alreadyIgnored} already ignored).`);
            return;
        }

        const seconds = Math.round((ids.size * REQUEST_DELAY_MS) / 1000);
        const ok = confirm(
            `Found ${ids.size} games to ignore (${alreadyIgnored} already ignored).\n` +
            `This will take about ${seconds}s. Continue?`
        );
        if (!ok) { setStatus('Cancelled.'); return; }

        const sessionid = getSessionId();
        if (!sessionid) throw new Error('sessionid cookie not found. Are you logged in?');

        let done = 0;
        let failed = 0;

        for (const id of ids) {
            if (cancelled) break;

            try {
                const body = new URLSearchParams({
                    sessionid,
                    appid: id,
                    remove: '0',
                    snr: SNR,
                });
                const res = await fetch('https://store.steampowered.com/recommended/ignorerecommendation/', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body,
                });

                if (res.ok) {
                    done++;
                } else {
                    failed++;
                    console.warn(`[steam-ignore] id ${id} -> HTTP ${res.status}`);
                    if (res.status === 429) {
                        setStatus('Rate limited by Steam (429). Stopping; try again later.');
                        return;
                    }
                }
            } catch (err) {
                failed++;
                console.warn(`[steam-ignore] id ${id} failed`, err);
            }

            setStatus(`Ignoring… ${id}. Progress ${done + failed}/${ids.size} (${failed} failed)`);
            await sleep(REQUEST_DELAY_MS);
        }

        setStatus(
            cancelled
                ? `Stopped. Ignored ${done}/${ids.size}, ${failed} failed.`
                : `Done! Ignored ${done}/${ids.size}, ${failed} failed. Reload to see changes.`
        );
    }
})();
