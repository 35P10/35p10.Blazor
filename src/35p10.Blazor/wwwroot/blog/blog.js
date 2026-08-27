let tracker = null;
let suppressTrackingUntil = 0;
let sectionTrackerRef = null;
let popstateAttached = false;

export function scrollToId(id, options = {}) {
    const updateHash = options.updateHash !== false;
    const push = options.push !== false;

    const el = document.getElementById(id);
    if (!el) {
        return;
    }

    markHashTarget(el);

    if (updateHash) {
        setLocationHash(id, push);
    }

    if (sectionTrackerRef) {
        sectionTrackerRef.invokeMethodAsync("OnActiveSectionChanged", id);
    }

    const container = el.closest(".blog-body");
    if (!container) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const top =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        margin;
    // A smooth scroll crosses every section in between. Freeze the tracker so the
    // index keeps the clicked entry active instead of flickering through them.
    suppressTrackingUntil = performance.now() + 1200;
    container.scrollTo({ top, behavior: "smooth" });
}

export function startSectionTracking(dotNetRef) {
    stopSectionTracking();

    sectionTrackerRef = dotNetRef;

    const container = document.querySelector(".blog-body");
    const toc = document.querySelector(".blog-toc");
    if (!container) {
        return;
    }

    let pending = 0;
    let lastId = null;

    const update = () => {
        pending = 0;

        if (performance.now() < suppressTrackingUntil) {
            return;
        }

        const id = activeSectionId(container);
        if (id && id !== lastId) {
            lastId = id;
            setLocationHash(id, false);
            dotNetRef.invokeMethodAsync("OnActiveSectionChanged", id);
            // Blazor paints the new active entry a tick later.
            setTimeout(revealActiveTocEntry, 80);
        }
    };

    const onScroll = () => {
        // A timer, not requestAnimationFrame: a backgrounded tab stops painting and
        // the index would freeze mid-article until it comes back.
        if (!pending) {
            pending = setTimeout(update, 60);
        }
    };

    // When the TOC fits the viewport (View360), the wheel over it does nothing:
    // the article is a sibling scroll pane, not an ancestor. Forward that wheel.
    // When the TOC overflows (Chart Gaze), leave its own scroll alone.
    const onTocWheel = (event) => {
        if (!toc || event.ctrlKey) {
            return;
        }

        const delta = event.deltaY;
        if (delta === 0) {
            return;
        }

        if (toc.scrollHeight > toc.clientHeight + 1) {
            return;
        }

        container.scrollTop += delta;
        event.preventDefault();
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    if (toc) {
        toc.addEventListener("wheel", onTocWheel, { passive: false });
    }

    tracker = {
        container,
        toc,
        onScroll,
        onTocWheel,
        cancel: () => {
            if (pending) {
                clearTimeout(pending);
                pending = 0;
            }
        },
    };

    onScroll();
}

export function stopSectionTracking() {
    if (!tracker) {
        sectionTrackerRef = null;
        return;
    }

    tracker.container.removeEventListener("scroll", tracker.onScroll);
    window.removeEventListener("resize", tracker.onScroll);
    if (tracker.toc && tracker.onTocWheel) {
        tracker.toc.removeEventListener("wheel", tracker.onTocWheel);
    }
    tracker.cancel();
    tracker = null;
    sectionTrackerRef = null;
}

function revealActiveTocEntry() {
    const toc = document.querySelector(".blog-toc");
    const link = toc?.querySelector(".blog-toc-link.is-active");
    if (!toc || !link || toc.scrollHeight <= toc.clientHeight) {
        return;
    }

    const tocBox = toc.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();

    if (linkBox.top < tocBox.top) {
        toc.scrollTop -= tocBox.top - linkBox.top + 8;
    } else if (linkBox.bottom > tocBox.bottom) {
        toc.scrollTop += linkBox.bottom - tocBox.bottom + 8;
    }
}

function activeSectionId(container) {
    const sections = container.querySelectorAll(".blog-section[id]");
    if (sections.length === 0) {
        return null;
    }

    const containerTop = container.getBoundingClientRect().top;
    // A section counts as reached once its top crosses a line a fifth into the view.
    const line = containerTop + container.clientHeight * 0.2;

    let current = sections[0].id;
    for (const section of sections) {
        if (section.getBoundingClientRect().top <= line) {
            current = section.id;
        }
    }

    // At the bottom the last section may never cross the line: claim it anyway.
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
        current = sections[sections.length - 1].id;
    }

    return current;
}

// history.pushState does not move the document's target element, so :target never
// fires on an in-page click. Mark the destination explicitly instead.
function markHashTarget(el) {
    for (const previous of document.querySelectorAll(".is-hash-target")) {
        previous.classList.remove("is-hash-target");
    }

    el.classList.add("is-hash-target");
}

function setLocationHash(id, push) {
    const url = new URL(window.location.href);
    const next = `#${id}`;
    if (url.hash === next) {
        return;
    }

    url.hash = id;
    if (push) {
        history.pushState(null, "", url);
    } else {
        history.replaceState(null, "", url);
    }
}

let hashLinksAttached = false;
const focusTargets = new Map();

export function getFocusId() {
    return new URL(window.location.href).searchParams.get("focus");
}

/** @returns {boolean|null} null when the URL does not set close */
export function getFocusClosable() {
    const value = new URL(window.location.href).searchParams.get("close");
    if (value === null || value === "") {
        return null;
    }

    const normalized = value.trim().toLowerCase();
    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }

    return null;
}

export function setFocusRoute(id, closable = null, push = true) {
    const url = new URL(window.location.href);

    if (id) {
        url.searchParams.set("focus", id);
        if (closable === false) {
            url.searchParams.set("close", "0");
        } else if (closable === true) {
            url.searchParams.delete("close");
        }
        // closable === null: leave whatever close= is already in the URL
    } else {
        url.searchParams.delete("focus");
        url.searchParams.delete("close");
    }

    if (push) {
        history.pushState(null, "", url);
    } else {
        history.replaceState(null, "", url);
    }
}

export function setFocusId(id, push = true) {
    setFocusRoute(id, id ? null : null, push);
}

export function registerFocusTarget(id, dotNetRef) {
    focusTargets.set(id, dotNetRef);
    ensurePopstate();
    syncFocusFromUrl();
}

export function unregisterFocusTarget(id) {
    focusTargets.delete(id);
}

export function openFocus(id, closable = true) {
    if (!id) {
        return;
    }

    setFocusRoute(id, closable !== false, true);
    syncFocusFromUrl();
}

export function closeFocus(id) {
    if (id && getFocusId() === id) {
        setFocusRoute(null, null, true);
    }

    syncFocusFromUrl();
}

function syncFocusFromUrl() {
    const current = getFocusId();
    const closable = getFocusClosable();
    for (const [id, ref] of focusTargets) {
        ref.invokeMethodAsync("OnFocusRouteChanged", id === current, closable);
    }
}

function ensurePopstate() {
    if (popstateAttached) {
        return;
    }

    popstateAttached = true;
    window.addEventListener("popstate", () => {
        scrollToLocationHash();
        syncFocusFromUrl();
    });
}

export function attachInPageHashLinks() {
    if (!hashLinksAttached) {
        hashLinksAttached = true;
        document.addEventListener("click", handleInPageHashClick, true);
    }

    ensurePopstate();

    // Nested sections register on first paint; retry once if the hash target
    // is not in the DOM yet.
    if (!scrollToLocationHash()) {
        requestAnimationFrame(() => scrollToLocationHash());
    }
}

export function scrollToLocationHash() {
    const id = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
    if (!id) {
        return false;
    }

    if (!document.getElementById(id)) {
        return false;
    }

    scrollToId(id, { updateHash: false });
    return true;
}

function handleInPageHashClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
        return;
    }

    const anchor = target.closest("a[href]");
    if (!anchor || !anchor.closest(".blog-shell")) {
        return;
    }

    const id = inPageHashId(anchor);
    if (!id || !document.getElementById(id)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    scrollToId(id);
}

function inPageHashId(anchor) {
    const href = anchor.getAttribute("href");
    if (!href) {
        return null;
    }

    // Raw "#id" must be read from the attribute. With <base href="/"> the
    // resolved anchor.href becomes "/#id" and would leave the current page.
    if (href.startsWith("#")) {
        return href.length > 1 ? decodeURIComponent(href.slice(1)) : null;
    }

    let url;
    try {
        url = new URL(anchor.href, window.location.href);
    } catch {
        return null;
    }

    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
        return null;
    }

    return url.hash.length > 1 ? decodeURIComponent(url.hash.slice(1)) : null;
}
