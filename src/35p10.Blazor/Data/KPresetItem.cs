namespace k35p10.Blazor;

/// <summary>
///     One saved state of a screen, as <see cref="KPresetPicker" /> shows it.
/// </summary>
/// <param name="Id">Whatever the application calls it; this component only passes it back.</param>
/// <param name="Description">
///     What it restores, said in words. Optional, and worth the trouble: a list of names stops
///     meaning anything once there are a few of them.
/// </param>
public sealed record KPresetItem(string Id, string Name, string? Description = null);
