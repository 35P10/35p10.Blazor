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

    public string RegisterSection(string id, string title)
    {
        var existing = _sections.FirstOrDefault(section => section.Id == id);
        if (existing is not null)
        {
            return existing.Number;
        }

        var number = (_sections.Count + 1).ToString();
        _sections.Add(new BlogSectionInfo(id, number, title));
        NotifyChanged();
        return number;
    }

    public async Task ScrollToSectionAsync(string id)
    {
        ActiveSectionId = id;
        NotifyChanged();

        _module ??= await _js.InvokeAsync<IJSObjectReference>("import", ModulePath);
        await _module.InvokeVoidAsync("scrollToId", id);
    }

    private void NotifyChanged() => Changed?.Invoke();

    public async ValueTask DisposeAsync()
    {
        if (_module is not null)
        {
            await _module.DisposeAsync();
        }
    }
}
