using Microsoft.JSInterop;

namespace k35p10.Blazor;

public sealed class BlogArticleContext : IAsyncDisposable
{
    private const string ModulePath = "./_content/35p10.Blazor/blog/blog.js";

    private readonly IJSRuntime _js;
    private readonly List<BlogSectionInfo> _sections = [];
    private IJSObjectReference? _module;

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
            await _module.DisposeAsync();
        }
    }
}
