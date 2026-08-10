namespace k35p10.Blazor;

public sealed record KNavItem(string Href, string Label, KIconName? Icon = null, bool MatchAll = false);
