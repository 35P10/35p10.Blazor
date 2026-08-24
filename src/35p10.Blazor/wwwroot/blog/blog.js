let tracker = null;
let suppressTrackingUntil = 0;

export function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) {
        return;
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

    const container = document.querySelector(".blog-body");
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

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    tracker = {
        container,
        onScroll,
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
        return;
    }

    tracker.container.removeEventListener("scroll", tracker.onScroll);
    window.removeEventListener("resize", tracker.onScroll);
    tracker.cancel();
    tracker = null;
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

let hashLinksAttached = false;

export function attachInPageHashLinks() {
    if (!hashLinksAttached) {
        hashLinksAttached = true;
        document.addEventListener("click", handleInPageHashClick, true);
    }

    scrollToLocationHash();
}

export function scrollToLocationHash() {
    const id = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
    if (id) {
        scrollToId(id);
    }
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

    const url = new URL(window.location.href);
    url.hash = id;
    history.pushState(null, "", url);
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
