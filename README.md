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

<KButton Variant="KButtonVariant.Choice" Active="@isSelected" OnClick="() => Select(item.Id)">
    <span>@item.Name</span>
</KButton>
```

`KCard` renders a `<div>` (or an `<a>` when `Href` is set) with class `card`. `KButton` renders a `<button>` (or an `<a>` when `Href` is set) with class `action-button`, plus `primary`/`danger`/`icon-only`/`choice` modifiers driven by the `Variant`/`IconOnly` parameters.

`KButtonVariant.Choice` covers the "selectable list item" pattern found duplicated across 5 files (`question-chip`, `evaluator-item`, `image-thumb`, `trial-tab`, `trial-item`): a full-width, left-aligned row that's gray by default and gets a blue-tinted border+background when selected — a genuinely different look from `Primary`/`Danger` (which stay compact/inline for one-off actions), not just a color swap. Pair it with the separate `Active` bool parameter (works with any variant, but only `Choice` has visual styling for `.is-active`) instead of computing `Variant` conditionally — `Active="@isSelected"` reads clearer than `Variant="@(isSelected ? ... : ...)"` at call sites where "selected" isn't the same idea as "primary action". Each of the 5 migrated usages needed its own internal layout (a 2-column grid for `question-chip`, a checkmark+body grid for `evaluator-item`, ...) which `Choice`'s own CSS doesn't dictate — add `Class="your-name"` and a page-level `::deep .action-button.your-name { ... }` rule for whatever internal grid/gap/background the specific list needs on top of the shared base look.

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

## Checkbox, range, file upload, image

```razor
<KCheckbox @bind-Value="ExportPanorama">Panorama</KCheckbox>

<KRange TValue="double" Min="0.5" Max="3" Step="0.1" @bind-Value="HeatmapLevel">Level</KRange>
<KRange TValue="int" Min="0" Max="@MaxSampleIndex.ToString()" Step="1" Value="SelectedSampleIndex" ValueChanged="HandleTimelineInput" />

<KFileUpload Disabled="IsBusy" OnChange="OnFileSelectedAsync" Accept=".jpg,.jpeg,.png,image/jpeg,image/png">
    <UiIcon Name="image-add" />
    <span>Choose image</span>
</KFileUpload>

<KImage Src="@Api.GetImageUrl(Session.Id, image.Id)" Alt="@GetImageName(image)">
    @if (isActive)
    {
        <span class="active-badge">Active</span>
    }
</KImage>
```

- `KCheckbox` — a `<label>` wrapping `<input type="checkbox">` + a `<span>` for `ChildContent`; bindable via `Value`/`ValueChanged` (`bool`). Grounded in `StreetView.razor`'s 5 export-format checkboxes and `SessionControl.razor`'s trial-picker checkbox.
- `KRange<TValue>` — a `<label>` wrapping an optional leading `ChildContent` span, `<input type="range">`, and an optional trailing `ValueLabel`. Generic over any `struct` implementing `IParsable<TValue>`/`IFormattable` (double, int, ...), parsed with `CultureInfo.InvariantCulture`. `Min`/`Max` are plain strings (pass-through to the native attribute), so a non-string value needs `.ToString()` at the call site (e.g. `Max="@MaxSampleIndex.ToString()"`). Grounded in `Player.razor`'s heatmap-level slider and timeline scrubber. **Not** used for `ErpFovExplorer.razor`'s FOV slider — that component is out of scope for this library (360° viewer content, not dashboard chrome).
- `KFileUpload` — a `<label>` wrapping `ChildContent` (icon + text) and Microsoft's built-in `<InputFile>`, visually hidden and stretched over the label so the whole label is the click target. Always renders the solid blue/white "primary" look — the app's original `.image-upload` CSS declared a neutral-gray variant that a later same-specificity rule always overrode, so blue/white was the only look that ever actually rendered; `KFileUpload` matches that real behavior rather than the unreachable rule. Grounded in `Trials.razor` and `Segmentation.razor`'s image-upload buttons.
- `KImage` — a `<div>` framing an `<img>` (rounded border, `overflow: hidden`, `object-fit: cover`) plus `ChildContent` for an absolutely-positioned overlay badge, if any. `AspectRatio` defaults to `"2 / 1"` (the only ratio found in the app) and accepts any valid CSS `aspect-ratio` value. Grounded in `SessionControl.razor`'s `.image-preview` image-grid tiles. **Not** used for `Trials.razor`'s `.trial-image` cards or `Segmentation.razor`'s `<figure>` previews — both mix the image with unrelated sibling content (a metadata form, conditional fallback states) rather than just framing it with an optional overlay, so wrapping them would either double up the border/radius or force an incorrect aspect-ratio onto the whole card.

## Icons

```razor
<KIcon Name="KIconName.Refresh" />
<KIcon Name="KIconName.Trash" Size="1.25rem" />
```

`KIcon` replaces `GazeLab.Web`'s `UiIcon` (string `Name` lookup) with a `KIconName` enum — one value per icon path, so a typo'd name is a compile error instead of a silent fallback to the default glyph. `Size` is a plain CSS length string (default `"1rem"`) applied directly as inline `width`/`height` — kept as a free-form string rather than a size-tier enum, since the two real sizes found in the app (`1rem` action icons, `1.25rem` nav icons) are just two arbitrary points, not a meaningful small/medium/large scale.

Two icon families exist in `KIconName`: the action-icon set (`Plus`, `Refresh`, `ImageAdd`, `Trash`, `ChevronUp`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `Save`, `Aoi`, `Edit`, `Close`) migrated from `UiIcon`, and the `Nav*`-prefixed set (`NavHome`, `NavChartGaze`, `NavSessionControl`, `NavTrials`, `NavSessions`, `NavLiveGaze`, `NavPlayer`, `NavStreetView`, `NavSegmentation`) migrated from `NavMenu.razor`'s inline `<svg>` sidebar icons. `ChevronLeft`/`ChevronRight` were added alongside the other two to round out a full 4-direction chevron set, replacing `NavMenu.razor`'s `"«"`/`"»"` text-glyph sidebar-collapse toggle.

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

## Section headers

```razor
<KSectionHeader Tag="header" Class="trials-hero">
    <ChildContent>
        <div>
            <KText Variant="KTextVariant.Title">Trials</KText>
            <KText Variant="KTextVariant.Muted">@VisibleTrials.Count trial(s)</KText>
        </div>
    </ChildContent>
    <Actions>
        <KButton OnClick="LoadTrialsAsync">Refresh</KButton>
    </Actions>
</KSectionHeader>
```

`KSectionHeader` unifies the single most duplicated layout shape in the app: a flex row with a title on the left and optional actions (badge/button/pill-group) on the right, `justify-content: space-between`, stacking to a column below 640px. It was copy-pasted under at least five different class names (`X-hero` on nearly every page's top banner, `panel-head`/`section-head` on card/panel headers) with byte-identical CSS. Two named `RenderFragment` parameters: `ChildContent` (the title side) and `Actions` (optional, right side) — **when both are used, wrap `ChildContent` in an explicit `<ChildContent>` tag**; Razor's compiler rejects mixing bare/implicit child content with another named `RenderFragment` tag as siblings (`RZ9996`). If a fragment's content is conditional, put the `@if` *inside* the tag rather than around the tag itself — wrapping the `<Actions>` tag itself in `@if` trips the same compiler restriction even when `ChildContent` is explicit. `Tag` defaults to `"div"`; set `Tag="header"` for page-level banners that were a semantic `<header>` element. Pass the page's own class via `Class` and re-declare only the *extra* CSS properties the component doesn't provide (margin, a wider/narrower responsive breakpoint, etc.) with `::deep`.

## Sidebar navigation

```razor
<KSidebarNav BrandText="GazeLab Studio"
             Items="NavItems"
             IsCollapsed="IsSidebarCollapsed"
             IsCollapsedChanged="OnSidebarCollapsedChanged" />

@code {
    private static readonly IReadOnlyList<KNavItem> NavItems = new List<KNavItem>
    {
        new("", "Home", KIconName.NavHome, MatchAll: true),
        new("trials", "Trials", KIconName.NavTrials),
        // ...
    };
}
```

`KSidebarNav` is the collapsible win98-style sidebar shell — brand row with a collapse toggle (desktop) and a hamburger toggle (mobile, closes on nav click), plus the `<NavLink>` list itself with active/hover states. It replaced `GazeLab.Web`'s `NavMenu.razor`, which was 100% chrome (the CSS) hard-coded around one specific list of 9 routes — the chrome is the reusable part, so it moved here; the route list stays app-owned, passed in as `IReadOnlyList<KNavItem>` (`Href`, `Label`, `Icon`, `MatchAll` for the home/root link). `IsCollapsed`/`IsCollapsedChanged` bind the desktop collapse state (owned by the host layout, since it also affects the host's own `.sidebar` width — see `MainLayout.razor.css`'s `.sidebar.is-collapsed { width: 88px; }`); the mobile hamburger state is internal, matching the original. This is the first component here with a routing dependency (`Microsoft.AspNetCore.Components.Routing` for `NavLink`/`NavLinkMatch`) — every other component in this library is routing-agnostic.

Deliberately NOT included: the surrounding page shell (`MainLayout.razor`'s `.page`/`.sidebar`/`main` grid, sticky positioning, the player-route upload bar). That's a separate, deeper layer — `KSidebarNav` is just what goes *inside* the sidebar slot a host layout provides.

## Toasts

```razor
@inject ToastService ToastService
@implements IDisposable

<KToastStack Toasts="@Items" OnDismiss="@(id => ToastService.Dismiss(id))" />

@code {
    IReadOnlyList<KToastItem> Items => ToastService.Toasts
        .Select(toast => new KToastItem(toast.Id, toast.Message, toast.Kind == ToastKind.Error ? KColor.Danger : KColor.Primary, toast.Duration))
        .ToList();
    // OnInitialized/Dispose subscribe/unsubscribe ToastService.Changed to re-render on new toasts, as before.
}
```

`KToastStack` is purely presentational — it renders a fixed top-right stack of dismissible, auto-expiring toast messages from an `IReadOnlyList<KToastItem>` (`Id`, `Message`, `Color`, `Duration`) and an `OnDismiss` callback. Unlike every other component here, this one didn't already have *duplicated* markup to unify — `ToastHost.razor` was (and still is) the only toast host in the app. It's extracted anyway because the actual scheduling/dismissal logic (`ToastService`, `AppToast`, `ToastKind`) is legitimate app-specific state management that doesn't belong in a UI library, while the rendering underneath it is pure CSS with zero GazeLab-specific logic — so only that rendering layer moved. `Color` reuses `KColor` directly (`Primary` for info, `Danger` for error) rather than a separate variant enum, since the accent colors already matched `KColor.Primary`/`KColor.Danger`'s underlying CSS vars exactly.

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
