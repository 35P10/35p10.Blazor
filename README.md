# 35p10.Blazor

Reusable Blazor components: blog-style article pages (header, sections, a scroll-spy table of contents, code blocks) and shared UI primitives (`KCard`, `KButton`).

## Blog usage

```razor
@using k35p10.Blazor

<KBlogArticle InitialSectionId="overview">
    <Header>
        <KBlogHeader Title="My Article" Meta="2026-08-08" Lead="A short summary." />
    </Header>
    <ChildContent>
        <KBlogSection Id="overview" Title="Overview">
            <p>Content goes here.</p>
            <KBlogCode Code="dotnet pack" />
        </KBlogSection>
    </ChildContent>
</KBlogArticle>
```

`KBlogArticle` builds the table of contents automatically from the `KBlogSection` children it renders, and handles smooth-scrolling to a section when a TOC entry is clicked. Component names are prefixed with `K` to avoid tag-name collisions with other component libraries; the underlying CSS classes (`blog-header`, `blog-section`, ...) are unprefixed.

## UI usage

```razor
@using k35p10.Blazor

<KCard Class="my-card">
    <HeaderContent>
        <h2>Title</h2>
    </HeaderContent>
    <ChildContent>
        <p>Body content.</p>
    </ChildContent>
</KCard>

<KButton Variant="@KButtonVariant.Primary" OnClick="Save">Save</KButton>
<KButton Href="/back">Back</KButton>
```

`KCard` renders a `<div>` (or an `<a>` when `Href` is set) with class `card`. `KButton` renders a `<button>` (or an `<a>` when `Href` is set) with class `action-button`, plus `primary`/`danger`/`icon-only` modifiers driven by the `Variant`/`IconOnly` parameters.

## Typography

```razor
<KText Variant="@KTextVariant.Title">GazeLab</KText>
<KText Variant="@KTextVariant.Caption">Lab</KText>
<KText Variant="@KTextVariant.Lead">Informes de investigación y herramientas del laboratorio.</KText>
<KText>Default body copy.</KText>
```

`KTextVariant` covers `Title` (h1, 1.45rem/700), `Subtitle` (h2, 1.05rem/700), `Body` (p, 0.9rem — the default), `Lead` (p, 0.95rem, #444), `Caption` (p, 0.72rem/600, uppercase, #777 — the "eyebrow" label style already used in `KBlogHeader`/`KBlogToc`), and `Muted` (p, 0.82rem, #555). Each variant renders a sensible default HTML tag; override it with `Tag="h3"` (or `"span"`, `"p"`, etc.) when the semantic heading level needs to differ from the visual style.

An optional `Color` parameter (`KColor`) overrides the variant's default color independently of size/weight — e.g. a `Title` that needs to read as an error: `<KText Variant="@KTextVariant.Title" Color="@KColor.Danger">Failed</KText>`. Options: `Muted` (`--win98-muted`), `Primary` (`--win98-blue-strong`), `Danger` (`--win98-danger`), `Success` (`--win98-success`), `Warning` (`--win98-warning`) — the same status colors already used for connection/recording state pills across the app. Leave `Color` unset to keep the variant's own color.

`KColor` is a general-purpose semantic color token, not tied to `KText` — it's the natural type to reach for on any future component (badges, borders, icons, ...) that needs one of these five status colors. `KButtonVariant` was kept separate on purpose: a button's `Default` variant is a distinct neutral chrome, not just "no color," so it isn't a good fit for `KColor`'s "unset = inherit" semantics.

Each `KColor` member maps directly to its `var(--win98-...)` expression via the `ToVar()` extension method (`KColor.Danger.ToVar()` → `"var(--win98-danger, #8f3a3a)"`), so a component just does `style="color: @Color.Value.ToVar()"` — no intermediate CSS class or lookup table to keep in sync.

## Theming

The full color palette (the "win98" design system) lives in `wwwroot/theme.css` as `:root` custom properties. Link it once from the host app's `index.html`/`_Host`/`App.razor`, before any page-specific stylesheet:

```html
<link rel="stylesheet" href="_content/35p10.Blazor/theme.css" />
```

That defines:

- `--win98-bg`, `--win98-surface`, `--win98-surface-soft`
- `--win98-shadow-dark`, `--win98-shadow-mid`
- `--win98-highlight`, `--win98-highlight-soft`
- `--win98-blue`, `--win98-blue-strong`
- `--win98-text`, `--win98-muted`
- `--win98-danger`, `--win98-success`, `--win98-warning`
- `--ui-border`, `--ui-border-strong`

Components also carry inline fallback values (e.g. `var(--win98-blue, #1ba1e2)`), so they render correctly even without linking `theme.css` — linking it just lets every consuming app share the exact same palette instead of each one hardcoding fallbacks.
