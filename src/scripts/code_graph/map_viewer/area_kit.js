/*
 * Small pieces the Interfaces, Impact and Agent pages share: a status chip in
 * the design's tones, the shipped no-data tag with its reason, a copy button
 * for a command, and a link to a repository file where the page can reach it.
 */
extendStrings({
    en: { rlCopied: 'copied', rlCopyFail: 'select and copy:' },
    de: { rlCopied: 'kopiert', rlCopyFail: 'markieren und kopieren:' }
});

var RL_TONE = { ok: 'ok', warn: 'warn', bad: 'bad', cyan: 'cyan', dash: 'dash', line: 'rl-line', udash: 'rl-udash', rev: 'rl-rev', brand: 'rl-brand', live: 'ok' };

/** A status chip in one of the design's tones: tinted, outlined or dashed. */
function rlSt(text, tone, title) { return el('span', { class: 'st ' + (RL_TONE[tone] || 'dash'), title: title || null }, text); }

/** The shipped "no data" tag, carrying the reason in its tooltip. */
function rlNd(reason, short) {
    return el('span', { class: 'nodata-tag rl-nd', title: t('noDataTitle')(reason) }, short || t('noDataShort'));
}

/** A button that copies a command; where the clipboard is refused it shows the text to copy by hand. */
function rlCopy(label, text, cls) {
    var b = el('button', { type: 'button', class: cls || 'rl-btn', title: text }, label);
    b.addEventListener('click', function () {
        function done(ok) {
            b.textContent = ok ? label + ' · ' + t('rlCopied') : t('rlCopyFail') + ' ' + text;
            setTimeout(function () { b.textContent = label; }, ok ? 1600 : 6000);
        }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
            else done(false);
        } catch (e) { done(false); }
    });
    return b;
}

/** A rail's capitalised section head. */
function rlCap(text) { return el('span', { class: 'cap' }, text); }

/** Where the map sits in its repository, so a repository file can be linked from the page; null when the page is elsewhere. */
function rlRepoHref(file) {
    var m = /\/agents\/map\/(index\.html)?$/.exec(location.pathname);
    return m ? '../../' + file.split('/').map(encodeURIComponent).join('/') : null;
}
