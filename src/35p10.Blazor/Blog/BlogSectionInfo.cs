namespace k35p10.Blazor;

public sealed class BlogSectionInfo(string id, string number, string title, int level)
{
    private readonly List<BlogSectionInfo> _children = [];

    public string Id { get; } = id;

    public string Number { get; } = number;

    public string Title { get; } = title;

    public int Level { get; } = level;

    public IReadOnlyList<BlogSectionInfo> Children => _children;

    internal List<BlogSectionInfo> MutableChildren => _children;
}
