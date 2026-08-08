# 35p10.Blazor

Reusable Blazor components for blog-style article pages: header, sections, a scroll-spy table of contents, and code blocks.

## Usage

```razor
@using k35p10.Blazor

<BlogArticle InitialSectionId="overview">
    <Header>
        <BlogHeader Title="My Article" Meta="2026-08-08" Lead="A short summary." />
    </Header>

    <BlogSection Id="overview" Title="Overview">
        <p>Content goes here.</p>
        <BlogCode Code="dotnet pack" />
    </BlogSection>
</BlogArticle>
```

`BlogArticle` builds the table of contents automatically from the `BlogSection` children it renders, and handles smooth-scrolling to a section when a TOC entry is clicked.

## Theming

Styles fall back to sensible defaults but pick up these CSS custom properties if the host app defines them:

- `--win98-blue`
- `--win98-blue-strong`
- `--ui-border`
