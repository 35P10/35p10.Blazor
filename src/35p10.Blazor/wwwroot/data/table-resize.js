// Column resizing for KTable: drag the edge between two headers to change a width, double-click it
// to give that column back to its content. Widths are remembered per table key.
//
// Two rules decide how this feels, and both are deliberate:
//
//  * Dragging a column moves that column and nothing else. Every column is a number in pixels and
//    the table is exactly as wide as their sum, so there is no elastic column left to absorb the
//    difference and jump around while the reader is aiming at something else.
//  * While dragging, nothing is measured. The widths live in an array here and the drag writes to
//    it; reading offsetWidth back on every pointermove is what makes a resize stutter, because the
//    browser answers with the width it has just clamped rather than the one being asked for.
//
// The grips are created here rather than asked of whoever writes the table: a table declares
// Resizable and its markup stays a table.

const MinWidth = 56;

const storageKey = (key) => `k-table-columns:${key}`;

const read = (key) => {
    if (!key) {
        return {};
    }

    try {
        return JSON.parse(localStorage.getItem(storageKey(key)) ?? '{}');
    } catch {
        // Storage blocked by the browser, or somebody else's data under our key.
        return {};
    }
};

const write = (key, widths) => {
    if (!key) {
        return;
    }

    try {
        localStorage.setItem(storageKey(key), JSON.stringify(widths));
    } catch {
        // Not remembering a column width is not worth breaking a page over.
    }
};

/** What a column is called in storage: whatever the table says, or else its header text. */
const columnKey = (th) => th.dataset.column ?? th.textContent.trim();

/** Which columns this table has right now, in order: what a stored width was measured against. */
const signatureOf = (headers) => headers.map(columnKey).join(',');

/**
 * Puts the header's own content in a span, so that a column dragged narrow clips its text and not
 * the grip sitting at its edge. Done here because it is a requirement of resizing, not something
 * every table that wants to be resizable should have to write.
 */
const wrapLabel = (th) => {
    if (th.querySelector(':scope > .k-column-label')) {
        return;
    }

    const label = document.createElement('span');
    label.className = 'k-column-label';

    while (th.firstChild) {
        label.appendChild(th.firstChild);
    }

    th.appendChild(label);
};

export function enableColumnResize(wrap, tableKey) {
    const table = wrap?.querySelector('table');
    if (!table) {
        return;
    }

    const headers = [...table.querySelectorAll('thead th')];
    if (headers.length === 0) {
        return;
    }

    // Nothing to do while the table has the same columns it had: measuring again would undo a
    // width the reader has just dragged. A column hidden or moved changes this and re-measures.
    const signature = `${tableKey ?? ''}|${signatureOf(headers)}`;

    if (wrap._kColumnSignature === signature && wrap._kColumnResize) {
        return;
    }

    disableColumnResize(wrap);
    wrap._kColumnSignature = signature;

    headers.forEach(wrapLabel);

    const saved = read(tableKey);

    // Measured while the layout is still automatic and the table still stretches: those numbers
    // are what the content asks for, given the room there is.
    const widths = headers.map(th => Math.max(MinWidth, Math.round(saved[columnKey(th)] ?? th.offsetWidth)));

    // One-off, and only for columns nobody has resized: if what the content asked for leaves room
    // over, the first column takes it, so the table starts out filling its box exactly instead of
    // showing a scrollbar for the last few pixels. From here on the table never stretches again.
    const spare = wrap.clientWidth - widths.reduce((a, b) => a + b, 0);

    if (spare > 0 && saved[columnKey(headers[0])] === undefined) {
        widths[0] += spare;
    }

    table.classList.add('is-resizable');
    table.style.tableLayout = 'fixed';

    let frame = 0;

    const apply = () => {
        frame = 0;
        headers.forEach((th, i) => { th.style.width = `${widths[i]}px`; });
        table.style.width = `${widths.reduce((a, b) => a + b, 0)}px`;

        // Explicitly zero, and inline: a stylesheet that says the table is at least as wide as its
        // box — a reasonable thing to say before this script arrives — would stretch it, and a
        // stretched table hands the surplus to every column at once. That is what makes dragging
        // one column look like it moves the others.
        table.style.minWidth = '0px';
    };

    /** Painted at most once per frame: a pointer can fire faster than the browser can lay out. */
    const schedule = () => {
        frame ||= requestAnimationFrame(apply);
    };

    apply();

    const removers = [];
    const on = (element, type, handler) => {
        element.addEventListener(type, handler);
        removers.push(() => element.removeEventListener(type, handler));
    };

    headers.forEach((th, index) => {
        const grip = document.createElement('span');
        grip.className = 'k-column-grip';
        grip.setAttribute('aria-hidden', 'true');
        grip.title = 'Drag to resize · double-click to reset';
        th.appendChild(grip);
        removers.push(() => grip.remove());

        on(grip, 'pointerdown', event => {
            if (event.button !== 0) {
                return;
            }

            // Not a text selection, and not a click on the header underneath.
            event.preventDefault();
            event.stopPropagation();

            try {
                grip.setPointerCapture(event.pointerId);
            } catch {
                // Synthetic or exotic pointers: the window listeners below carry the drag anyway.
            }

            const startX = event.clientX;
            const startWidth = widths[index];

            table.classList.add('is-resizing');
            grip.classList.add('is-active');
            // The cursor is the gesture: it must not change over whatever the pointer crosses.
            document.body.classList.add('k-column-resizing');

            const finish = save => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', cancel);
                window.removeEventListener('keydown', key);

                table.classList.remove('is-resizing');
                grip.classList.remove('is-active');
                document.body.classList.remove('k-column-resizing');

                if (!save) {
                    widths[index] = startWidth;
                    schedule();

                    return;
                }

                // All of them, not only the one that moved: a width that came from measuring is
                // just as much a decision as one that came from a drag, and forgetting it would
                // let the whole table shift on the next load.
                const stored = read(tableKey);
                headers.forEach((header, i) => { stored[columnKey(header)] = widths[i]; });
                write(tableKey, stored);
            };

            const move = moveEvent => {
                widths[index] = Math.max(MinWidth, Math.round(startWidth + moveEvent.clientX - startX));
                schedule();
            };

            const up = upEvent => { move(upEvent); finish(true); };
            const cancel = () => finish(false);
            const key = keyEvent => {
                if (keyEvent.key === 'Escape') {
                    keyEvent.preventDefault();
                    finish(false);
                }
            };

            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', cancel);
            window.addEventListener('keydown', key);
        });

        on(grip, 'dblclick', event => {
            event.preventDefault();
            event.stopPropagation();

            const stored = read(tableKey);
            delete stored[columnKey(th)];
            write(tableKey, stored);

            // Only this column goes back to the automatic layout; the rest keep their numbers.
            table.style.tableLayout = 'auto';
            table.style.width = '';
            th.style.width = '';

            requestAnimationFrame(() => enableColumnResize(wrap, tableKey));
        });
    });

    wrap._kColumnResize = () => {
        if (frame) {
            cancelAnimationFrame(frame);
        }

        removers.forEach(remove => remove());
        table.classList.remove('is-resizable', 'is-resizing');
        document.body.classList.remove('k-column-resizing');
    };
}

/** Gives every column back to the content, forgetting the widths that were remembered. */
export function resetColumnWidths(wrap, tableKey) {
    const table = wrap?.querySelector('table');
    if (!table) {
        return;
    }

    write(tableKey, {});

    table.style.tableLayout = 'auto';
    table.style.width = '';
    table.style.minWidth = '';
    table.querySelectorAll('thead th').forEach(th => { th.style.width = ''; });

    requestAnimationFrame(() => enableColumnResize(wrap, tableKey));
}

export function disableColumnResize(wrap) {
    wrap?._kColumnResize?.();

    if (wrap) {
        wrap._kColumnResize = undefined;
        wrap._kColumnSignature = undefined;
    }
}
