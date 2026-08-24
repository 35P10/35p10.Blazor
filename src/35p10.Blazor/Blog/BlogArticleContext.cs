using Microsoft.JSInterop;

namespace k35p10.Blazor;

public sealed class BlogArticleContext : IAsyncDisposable
{
    private const string ModulePath = "./_content/35p10.Blazor/blog/blog.js";

    private readonly IJSRuntime _js;
    private readonly List<BlogSectionInfo> _sections = [];
    private IJSObjectReference? _module;
    private DotNetObjectReference<BlogArticleContext>? _selfRef;

    public BlogArticleContext(IJSRuntime js, string initialSectionId)
    {
        _js = js;
        ActiveSectionId = initialSectionId;
    }

    public event Action? Changed;

    public string ActiveSectionId { get; private set; }

    public IReadOnlyList<BlogSectionInfo> Sections => _sections;

    public BlogSectionInfo RegisterSection(string id, string title, BlogSectionInfo? parent = null)
    {
        var siblings = parent?.MutableChildren ?? _sections;

        var existing = siblings.FirstOrDefault(section => section.Id == id);
        if (existing is not null)
        {
            return existing;
        }

        var position = siblings.Count + 1;
        var number = parent is null ? position.ToString() : $"{parent.Number}.{position}";
        var section = new BlogSectionInfo(id, number, title, (parent?.Level ?? 0) + 1);
        siblings.Add(section);
        NotifyChanged();
        return section;
    }

    public async Task ScrollToSectionAsync(string id)
    {
        ActiveSectionId = id;
        NotifyChanged();

        await EnsureModuleAsync();
        await _module!.InvokeVoidAsync("scrollToId", id);
    }

    public async Task StartSectionTrackingAsync()
    {
        await EnsureModuleAsync();
        _selfRef ??= DotNetObjectReference.Create(this);
        await _module!.InvokeVoidAsync("startSectionTracking", _selfRef);
    }

    [JSInvokable]
    public void OnActiveSectionChanged(string id)
    {
        if (ActiveSectionId == id)
        {
            return;
        }

        ActiveSectionId = id;
        NotifyChanged();
    }

    public bool IsAncestorOfActive(BlogSectionInfo section) =>
        ActiveSectionId != section.Id &&
        Find(ActiveSectionId) is { } active &&
        active.Number.StartsWith($"{section.Number}.", StringComparison.Ordinal);

    private BlogSectionInfo? Find(string id) => Flatten(_sections).FirstOrDefault(section => section.Id == id);

    private static IEnumerable<BlogSectionInfo> Flatten(IEnumerable<BlogSectionInfo> sections)
    {
        foreach (var section in sections)
        {
            yield return section;

            foreach (var child in Flatten(section.Children))
            {
                yield return child;
            }
        }
    }

    public async Task AttachInPageHashLinksAsync()
    {
        await EnsureModuleAsync();
        await _module!.InvokeVoidAsync("attachInPageHashLinks");
    }

    private async Task EnsureModuleAsync() =>
        _module ??= await _js.InvokeAsync<IJSObjectReference>("import", ModulePath);

    private void NotifyChanged() => Changed?.Invoke();

    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            try
            {
                await _module.InvokeVoidAsync("stopSectionTracking");
            }
            catch (JSDisconnectedException)
            {
                // The circuit is already gone; nothing left to detach.
            }

            await _module.DisposeAsync();
        }

        _selfRef?.Dispose();
    }
}
