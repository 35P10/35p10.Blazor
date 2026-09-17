// Reordering a list by dragging a row.
//
// The DOM is not rearranged here. Blazor rendered this list and owns it, so moving its nodes behind
// its back would corrupt the next diff: what this does is show the move while the pointer is down
// and, on release, tell .NET where the row landed. The list then re-renders in the new order from
// the only copy of the order that matters, the application's.
//
// Pointer events and not HTML5 drag-and-drop: the latter needs a dataTransfer payload to start a
// drag in some browsers, and gives nothing in return that a list of rows needs.

/** Below this the gesture was a click, not a drag: a row can also be a checkbox. */
const DragThreshold = 4;

/** How near the edge of a scrolling list the pointer has to be for the list to follow it. */
const EdgeZone = 40;

/** How fast it follows, in pixels a frame, at the very edge; it eases in across the zone. */
const EdgeSpeed = 14;

/**
 * The box the row is being dragged inside of. A long list is taller than the dialog holding it, so
 * this is usually the list itself — but the list is not always the thing that scrolls, and the
 * drag has to answer to whichever one is.
 */
function scrollerOf(node) {
    for (let current = node; current && current !== document.body; current = current.parentElement) {
        const overflow = getComputedStyle(current).overflowY;

        if ((overflow === 'auto' || overflow === 'scroll')
            && current.scrollHeight > current.clientHeight) {
            return current;
        }
    }

    return null;
}

/** Bring a row into view without moving anything already in it: for moves made with the keyboard. */
export function revealKey(host, key) {
    host?.querySelector(`[data-reorder-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
}

export function enableReorder(host, handler) {
    if (!host) {
        return;
    }

    disableReorder(host);

    const rows = () => [...host.querySelectorAll('[data-reorder-key]')];

    const onPointerDown = event => {
        const row = event.target.closest('[data-reorder-key]');

        if (!row || event.button !== 0 || event.target.closest('input, button, a, select, textarea')) {
            return;
        }

        // Dragging a row and scrolling the list are the same gesture to a finger, and the list has
        // to stay scrollable. So a finger picks a row up by its handle, and a mouse — which scrolls
        // with its wheel — can take the row anywhere on it.
        if (event.pointerType !== 'mouse' && !event.target.closest('[data-reorder-grip]')) {
            return;
        }

        const startY = event.clientY;
        const order = rows();
        const from = order.indexOf(row);
        const scroller = scrollerOf(host);
        const startScroll = scroller ? scroller.scrollTop : 0;
        let pointerY = startY;
        let to = from;
        let dragging = false;
        let frame = 0;

        const cleanUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);
            cancelAnimationFrame(frame);

            row.style.transform = '';
            row.classList.remove('is-dragging');
            order.forEach(other => other.classList.remove('is-drop-before', 'is-drop-after'));
            host.classList.remove('is-reordering');
        };

        // Where the row is shown and where it would land, from the last known pointer position.
        // Called on every move and on every frame the list scrolls itself, because a list moving
        // under a pointer that is holding still changes both answers.
        const place = () => {
            // The row is offset from where the browser laid it out, and the browser moves it along
            // with everything else when the list scrolls: what the scrolling added has to be added
            // back, or the row slides out from under the pointer.
            const scrolled = scroller ? scroller.scrollTop - startScroll : 0;

            row.style.transform = `translateY(${pointerY - startY + scrolled}px)`;

            // Where it would land, counted among the rows that are not being dragged: that is the
            // position the application's own move works in.
            const others = order.filter(other => other !== row);
            let insertion = others.length;

            for (let index = 0; index < others.length; index++) {
                const box = others[index].getBoundingClientRect();

                if (pointerY < box.top + box.height / 2) {
                    insertion = index;
                    break;
                }
            }

            to = insertion;

            order.forEach(other => other.classList.remove('is-drop-before', 'is-drop-after'));

            if (insertion < others.length) {
                others[insertion].classList.add('is-drop-before');
            } else if (others.length > 0) {
                others[others.length - 1].classList.add('is-drop-after');
            }
        };

        // Holding a row against the top or bottom edge scrolls the list past it. Without this a row
        // could only ever be moved as far as the part of the list that happens to be on screen.
        const follow = () => {
            frame = requestAnimationFrame(follow);

            if (!scroller) {
                return;
            }

            const box = scroller.getBoundingClientRect();
            const above = pointerY - box.top;
            const below = box.bottom - pointerY;
            let by = 0;

            if (above < EdgeZone) {
                by = -EdgeSpeed * Math.min(1, (EdgeZone - above) / EdgeZone);
            } else if (below < EdgeZone) {
                by = EdgeSpeed * Math.min(1, (EdgeZone - below) / EdgeZone);
            }

            if (by === 0) {
                return;
            }

            const before = scroller.scrollTop;
            scroller.scrollTop += by;

            // At either end there is nothing left to scroll, and re-placing the row would be work
            // for an unchanged answer.
            if (scroller.scrollTop !== before) {
                place();
            }
        };

        const onMove = moveEvent => {
            pointerY = moveEvent.clientY;

            if (!dragging) {
                if (Math.abs(pointerY - startY) < DragThreshold) {
                    return;
                }

                dragging = true;
                row.classList.add('is-dragging');
                host.classList.add('is-reordering');
                frame = requestAnimationFrame(follow);

                try {
                    row.setPointerCapture(moveEvent.pointerId);
                } catch {
                    // Synthetic pointers: the window listeners carry the drag anyway.
                }
            }

            place();
        };

        const onUp = () => {
            const moved = dragging && to !== from;
            const dragged = dragging;
            const key = row.dataset.reorderKey;

            cleanUp();

            // A row usually holds a checkbox, and its label reacts to a click: letting go of a drag
            // must not also tick it. One click is swallowed, and only after a real drag.
            if (dragged) {
                const swallow = clickEvent => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                };

                row.addEventListener('click', swallow, { capture: true, once: true });
                setTimeout(() => row.removeEventListener('click', swallow, { capture: true }), 300);
            }

            if (moved) {
                handler.invokeMethodAsync('MovedTo', key, to - from);
            }
        };

        const onCancel = () => cleanUp();
        const onKey = keyEvent => {
            if (keyEvent.key === 'Escape') {
                keyEvent.preventDefault();
                cleanUp();
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('keydown', onKey);
    };

    host.addEventListener('pointerdown', onPointerDown);
    host._kListReorder = () => host.removeEventListener('pointerdown', onPointerDown);
}

export function disableReorder(host) {
    host?._kListReorder?.();

    if (host) {
        host._kListReorder = undefined;
    }
}
