namespace k35p10.Blazor;

public enum KColor
{
    Muted,
    Primary,
    Danger,
    Success,
    Warning,
}

public static class KColorExtensions
{
    public static string ToVar(this KColor color) => color switch
    {
        KColor.Muted => "var(--win98-muted, #555555)",
        KColor.Primary => "var(--win98-blue-strong, #1277a7)",
        KColor.Danger => "var(--win98-danger, #8f3a3a)",
        KColor.Success => "var(--win98-success, #176b36)",
        KColor.Warning => "var(--win98-warning, #765600)",
        _ => throw new ArgumentOutOfRangeException(nameof(color), color, null),
    };
}
