// Putting text on the clipboard.
//
// Two ways, because the good one is not always allowed: the asynchronous Clipboard API needs a
// secure context (https, or localhost) and a gesture the browser recognises. Where it is missing,
// a hidden textarea and the old command still work, and the caller gets told either way rather
// than being left to wonder whether the copy happened.

export async function copyText(text) {
    if (typeof text !== 'string' || text.length === 0) {
        return false;
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);

            return true;
        }
    } catch {
        // Denied, or no secure context: fall through to the old way.
    }

    try {
        const area = document.createElement('textarea');
        area.value = text;
        // Out of the way and unfocusable to the eye, but still selectable, which is what the old
        // command needs.
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';

        document.body.appendChild(area);
        area.select();

        const copied = document.execCommand('copy');
        area.remove();

        return copied;
    } catch {
        return false;
    }
}
