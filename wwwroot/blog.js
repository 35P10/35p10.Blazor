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

    const top =
        el.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
    container.scrollTo({ top: top, behavior: "smooth" });
}
