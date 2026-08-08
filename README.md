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

<KButton Variant="KButtonVariant.Primary" OnClick="Save">Save</KButton>
<KButton Href="/back">Back</KButton>
```

`KCard` renders a `<div>` (or an `<a>` when `Href` is set) with class `card`. `KButton` renders a `<button>` (or an `<a>` when `Href` is set) with class `action-button`, plus `primary`/`danger`/`icon-only` modifiers driven by the `Variant`/`IconOnly` parameters.

## Typography

```razor
<KText Variant="KTextVariant.Title">GazeLab</KText>
<KText Variant="KTextVariant.Caption">Lab</KText>
<KText Variant="KTextVariant.Lead">Informes de investigación y herramientas del laboratorio.</KText>
<KText>Default body copy.</KText>
```

`KTextVariant` covers two scales. The **dashboard/chrome scale** (page titles, panel headers, meta text — what `KCard`/`KButton`-based UIs use): `Title` (h1, 1.45rem/700), `Subtitle` (h2, 1.05rem/700), `Body` (p, 0.9rem — the default), `Lead` (p, 0.95rem, #444), `Caption` (p, 0.72rem/600, uppercase, #777 — the "eyebrow" label style), and `Muted` (p, 0.82rem, #555).

The **article scale** (matches `KBlogHeader`/`KBlogSection`'s own typography, meant for long-form reading rather than app chrome) — prefixed `Blog*` so they're never confused with the dashboard scale: `BlogDisplay` (h1, 2rem/700, tight letter-spacing — the article hero title), `BlogSectionHeading` (h2, 1.2rem/600, with a bottom border — the article section divider), `BlogByline` (p, 0.78rem, #777, no uppercase — the meta/date line under a `BlogDisplay` title), and `BlogIntro` (p, 1.05rem, #444 — a larger lead paragraph for article openings). These intentionally do NOT match the dashboard scale's `Title`/`Caption`/`Lead` sizes — blog reading typography is meant to feel distinct from panel chrome, not homogenized with it. `KBlogHeader`/`KBlogSection`/`KBlogToc` already use these internally.

Each variant renders a sensible default HTML tag; override it with `Tag="h3"` (or `"span"`, `"p"`, etc.) when the semantic heading level needs to differ from the visual style.

An optional `Color` parameter (`KColor`) overrides the variant's default color independently of size/weight — e.g. a `Title` that needs to read as an error: `<KText Variant="KTextVariant.Title" Color="KColor.Danger">Failed</KText>`. Options: `Muted` (`--win98-muted`), `Primary` (`--win98-blue-strong`), `Danger` (`--win98-danger`), `Success` (`--win98-success`), `Warning` (`--win98-warning`) — the same status colors already used for connection/recording state pills across the app. Leave `Color` unset to keep the variant's own color.

`KColor` is a general-purpose semantic color token, not tied to `KText` — it's the natural type to reach for on any future component (badges, borders, icons, ...) that needs one of these five status colors. `KButtonVariant` was kept separate on purpose: a button's `Default` variant is a distinct neutral chrome, not just "no color," so it isn't a good fit for `KColor`'s "unset = inherit" semantics.

Each `KColor` member maps directly to its `var(--win98-...)` expression via the `ToVar()` extension method (`KColor.Danger.ToVar()` → `"var(--win98-danger, #8f3a3a)"`), so a component just does `style="color: @Color.Value.ToVar()"` — no intermediate CSS class or lookup table to keep in sync.

## Form inputs

```razor
<KTextInput @bind-Value="SessionName" Placeholder="Session name" MaxLength="100" />
<KNumberInput TValue="double" @bind-Value="Latitude" Step="any" />
<KNumberInput TValue="int" @bind-Value="CubemapFaceSize" Min="64" Max="8192" Step="64" />
<KSelect @bind-Value="TrialToAssignId">
    <option value="">Add trial</option>
    @foreach (var trial in AvailableTrials)
    {
        <option value="@trial.Id">@trial.Name</option>
    }
</KSelect>
<KTextArea @bind-Value="Notes" MaxLength="2000" />
<KTextArea @bind-Value="PanoUrl" Monospace="true" />
```

All four share the same `field-input` look (padding, border, radius, background, focus ring) — one visual language for every form control instead of each page re-declaring `padding: 0.6rem 0.75rem; border: 1px solid var(--ui-border); ...` verbatim. They're plain bindable wrapper components (`Value`/`ValueChanged`, so `@bind-Value` works) — no dependency on `EditForm`/`EditContext`, since none of this app's forms use one.

- `KTextInput` — wraps `<input>`; `Type` defaults to `"text"` but can be set to any simple input type that doesn't need its own component (e.g. `"email"`, `"password"`).
- `KNumberInput<TValue>` — wraps `<input type="number">`; generic over any `struct` numeric type implementing `IParsable<TValue>` (double, int, float, ...), parsed/formatted with `CultureInfo.InvariantCulture` so the decimal separator doesn't depend on the browser's locale. `Value` is always `TValue?` (nullable) — if you're binding to a NON-nullable numeric property, `@bind-Value` won't compile; wire it manually instead: `Value="@Prop" ValueChanged="@((int? v) => Prop = v ?? Prop)"`.
- `KSelect<TValue>` — wraps `<select>`; pass `<option>` elements as `ChildContent` exactly as you would natively. Generic over `string` or any `enum` (converted internally via `Enum.Parse`/`Convert.ChangeType`). Unlike `KNumberInput`, `Value` is plain `TValue` (not nullable) — an unconstrained generic's `TValue?` erases to non-nullable for value-type instantiations in C#, so keeping it nullable there would have made `enum`/`string` binding inconsistent. **Type inference gotcha**: when `ValueChanged` is a bare method group (e.g. `ValueChanged="OnModelChanged"` rather than a lambda), Razor sometimes fails to infer `TValue` from `Value` alone and errors with `cannot convert from 'method group' to 'EventCallback'`. If you hit that, add `TValue="YourType"` explicitly on the tag.
- `KTextArea` — wraps `<textarea>`; `resize: vertical` by default, plus an optional `Monospace` flag for the one legitimate outlier found in the app (a textarea for pasting a URL).

Deliberately NOT built yet: a checkbox or range-slider component. The existing checkboxes/sliders in the app are too few and too varied in surrounding layout to generalize well — extracting them now would mean designing without enough real usage to learn from.

## Badges

```razor
<KBadge>Idle</KBadge>
<KBadge Color="KColor.Success">Connected</KBadge>
<KBadge Color="KColor.Danger" Rounded="false">Failed</KBadge>
<KBadge Color="KColor.Success" Dot="true">Live</KBadge>
```

`KBadge` unifies the ~8 near-duplicate "status pill"/"badge" classes found across the app (`connection-pill`, `stream-pill`, `status-pill`, `seg-badge`, `trial-type-badge`, `metric-pill`, ...), which had drifted into several *different* shades of green/red/amber for the same semantic state. Reuses `KColor` (`Muted` default, `Primary`, `Danger`, `Success`, `Warning`) so every status pill in the app now shares exactly one green, one red, one amber. `Rounded` (default `true`) toggles between the fully-rounded "pill" shape and the more rectangular "badge" shape (`border-radius: 6px`) — both shapes existed in the app and neither is more "correct." `Dot="true"` adds a small leading `currentColor` dot (the one real precedent: `GazeLive`'s "Live" indicator).

Deliberately left OUT of this unification: `SessionControl`'s `.active-badge` and `View360`'s `.v360-resolution-badge` — both are absolutely-positioned overlay labels on top of an image thumbnail, a different concern (image annotation, not status communication) from every other badge found.

## Spinner, dialog, table

```razor
<KSpinner />

<KDialog @bind-IsOpen="ShowDialog" Title="@($"{Trial.Id} · {Image.Id}")">
    <p>Dialog body content.</p>
</KDialog>

<KTable MaxHeight="600px">
    <thead>
        <tr><th>Name</th><th>Value</th></tr>
    </thead>
    <tbody>
        @foreach (var row in Rows)
        {
            <tr class="@(row.IsCurrent ? "table-row-active" : "table-row-clickable")" @onclick="() => Select(row)">
                <td>@row.Name</td>
                <td>@row.Value</td>
            </tr>
        }
    </tbody>
</KTable>
```

- `KSpinner` — a single `<span class="spinner">`, the rotating-border loading indicator already duplicated (with two different `@keyframes` names) in `SessionControl.razor`/`Player.razor`. Compose it with your own text/`KCard` wrapper as needed — it doesn't bundle a label, matching how narrowly-scoped `KButton`/`KCard` are.
- `KDialog` — a backdrop + centered window modal (click backdrop or the built-in "Close" button to dismiss; clicks inside the window don't propagate to the backdrop). `@bind-IsOpen` controls visibility; `OnClose` fires for any side effects beyond closing. Only one dialog existed in the app before this (`Player.razor`'s image-source picker) — the API is intentionally minimal (`Title` + `ChildContent`) since there wasn't more real usage to design against yet.
- `KTable` — a thin wrapper around a native `<table>`: you still write `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>` yourself (tables have too much semantic structure to hide behind a component API), `KTable` just supplies the shared container look (scroll wrapper, border, sticky header, row font-size/padding) that was previously copy-pasted per page. Two opt-in row modifier classes — `table-row-clickable` (hover + pointer cursor) and `table-row-active` (current-row highlight) — cover the interaction patterns already found in the app (`Player.razor`'s sample rows, `ExperimentResultsView`'s comparison rows).

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
