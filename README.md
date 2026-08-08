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

Styles fall back to sensible defaults but pick up these CSS custom properties if the host app defines them:

- `--win98-blue`
- `--win98-blue-strong`
- `--ui-border`
- `--win98-surface`
- `--win98-surface-soft`
