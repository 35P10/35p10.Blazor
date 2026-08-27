namespace k35p10.Blazor;

/// <summary>
/// Cascaded by <see cref="KBlogFocus"/> so nested visuals can switch to a
/// height-driven layout while the focus is open.
/// </summary>
/// <param name="IsOpen">The focus is open (dialog or bare).</param>
/// <param name="IsBare">The focus is open with no bar, backdrop dismiss, or Escape.</param>
public sealed record BlogFocusState(bool IsOpen, bool IsBare)
{
    public static readonly BlogFocusState Closed = new(false, false);
}
