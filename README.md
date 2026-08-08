# 35p10.Blazor

Reusable Blazor components: blog-style article pages (header, sections, a scroll-spy table of contents, code blocks) and shared UI primitives (`KCard`, `KButton`).

## Blog usage

```razor
@using k35p10.Blazor

<BlogArticle InitialSectionId="overview">
    <Header>
        <BlogHeader Title="My Article" Meta="2026-08-08" Lead="A short summary." />
    </Header>
    <ChildContent>
        <BlogSection Id="overview" Title="Overview">
            <p>Content goes here.</p>
            <BlogCode Code="dotnet pack" />
        </BlogSection>
    </ChildContent>
</BlogArticle>
```

`BlogArticle` builds the table of contents automatically from the `BlogSection` children it renders, and handles smooth-scrolling to a section when a TOC entry is clicked.

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

<KButton Variant="KButtonVariant.Primary" OnClick="Save">Save</KButton>
<KButton Href="/back">Back</KButton>
```

`KCard` renders a `<div>` (or an `<a>` when `Href` is set) with class `card`. `KButton` renders a `<button>` (or an `<a>` when `Href` is set) with class `action-button`, plus `primary`/`danger`/`icon-only` modifiers driven by the `Variant`/`IconOnly` parameters. Component names are prefixed with `K` to avoid tag-name collisions with other component libraries; the underlying CSS classes (`card`, `action-button`, ...) are unprefixed.

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
- `--win98-text`, `--win98-danger`
- `--ui-border`, `--ui-border-strong`

Components also carry inline fallback values (e.g. `var(--win98-blue, #1ba1e2)`), so they render correctly even without linking `theme.css` — linking it just lets every consuming app share the exact same palette instead of each one hardcoding fallbacks.
