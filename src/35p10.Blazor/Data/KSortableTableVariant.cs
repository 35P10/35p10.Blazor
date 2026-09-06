namespace k35p10.Blazor;

/// <summary>Shell a <c>KSortableTable</c> renders into.</summary>
public enum KSortableTableVariant
{
    /// <summary>App chrome: the plain <c>KTable</c> shell.</summary>
    Data,

    /// <summary>Article body: the <c>KBlogTable</c> shell, with column ratios and a caption.</summary>
    Blog,
}
