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
    container.scrollTo({ top, behavior: "smooth" });
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
