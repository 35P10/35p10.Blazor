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

        const startY = event.clientY;
        const order = rows();
        const from = order.indexOf(row);
        let to = from;
        let dragging = false;

        const cleanUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('keydown', onKey);

            row.style.transform = '';
            row.classList.remove('is-dragging');
            order.forEach(other => other.classList.remove('is-drop-before', 'is-drop-after'));
            host.classList.remove('is-reordering');
        };

        const onMove = moveEvent => {
            const delta = moveEvent.clientY - startY;

            if (!dragging) {
                if (Math.abs(delta) < DragThreshold) {
                    return;
                }

                dragging = true;
                row.classList.add('is-dragging');
                host.classList.add('is-reordering');

                try {
                    row.setPointerCapture(moveEvent.pointerId);
                } catch {
                    // Synthetic pointers: the window listeners carry the drag anyway.
                }
            }

            // The row follows the pointer; the others stay put and one of them shows the edge the
            // row would land on. Cheaper than animating a reflow, and easier to read.
            row.style.transform = `translateY(${delta}px)`;

            // Where it would land, counted among the rows that are not being dragged: that is the
            // position the application's own move works in.
            const others = order.filter(other => other !== row);
            const y = moveEvent.clientY;
            let insertion = others.length;

            for (let index = 0; index < others.length; index++) {
                const box = others[index].getBoundingClientRect();

                if (y < box.top + box.height / 2) {
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
