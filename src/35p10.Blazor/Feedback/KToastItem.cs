namespace k35p10.Blazor;

public sealed record KToastItem(Guid Id, string Message, KColor Color, TimeSpan Duration);
