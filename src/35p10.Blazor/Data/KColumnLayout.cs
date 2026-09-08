namespace k35p10.Blazor;

/// <summary>A column a table could show, as the table's owner declares it.</summary>
/// <param name="Key">
///     How this column is named in a stored layout. It must survive reloads, so use something
///     stable — a field name, an id — rather than the title.
/// </param>
/// <param name="CanBeHidden">
///     False for a column that identifies the row: hiding it would leave a table nobody can read
///     back to anything.
/// </param>
public sealed record KColumnDefinition(string Key, string Title, bool CanBeHidden = true);

/// <summary>One column as it currently stands: where it is, and whether it is shown.</summary>
public sealed record KColumnState(string Key, string Title, bool IsVisible, bool CanBeHidden);

/// <summary>
///     Which columns of a table are shown and in what order, as a value that can be stored as text
///     — in an address, in a preference, wherever the application keeps such things. This type does
///     not decide where it lives, and it does not know what the columns mean.
///     <para>
///         Only what departs from the declared order is written down, so an untouched table has no
///         layout to carry. Two rules make a stored layout survive a table that has changed since:
///         a key that no longer exists is dropped without disturbing the rest, and a column that
///         has appeared since is shown in its declared place instead of staying invisible until
///         somebody goes looking for it.
///     </para>
/// </summary>
public sealed class KColumnLayout
{
    private const char HiddenMark = '-';

    private readonly List<string> _order;
    private readonly HashSet<string> _hidden;

    public KColumnLayout()
        : this([], [])
    {
    }

    private KColumnLayout(IEnumerable<string> order, IEnumerable<string> hidden)
    {
        _order = [.. order];
        _hidden = new HashSet<string>(hidden, StringComparer.Ordinal);
    }

    /// <summary>True when nothing has been rearranged, so nothing needs storing.</summary>
    public bool IsDefault => _order.Count == 0 && _hidden.Count == 0;

    /// <summary>
    ///     Reads a stored layout. Anything unrecognisable is ignored rather than rejected: a broken
    ///     layout should cost the reader nothing more than the arrangement it described.
    /// </summary>
    public static KColumnLayout Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new KColumnLayout();
        }

        var order = new List<string>();
        var hidden = new List<string>();

        foreach (var raw in value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var isHidden = raw[0] == HiddenMark;
            var key = isHidden ? raw[1..].Trim() : raw;

            if (key.Length == 0 || order.Contains(key, StringComparer.Ordinal))
            {
                continue;
            }

            order.Add(key);

            if (isHidden)
            {
                hidden.Add(key);
            }
        }

        return new KColumnLayout(order, hidden);
    }

    /// <summary>The layout as text, or null when it is the declared one and there is nothing to say.</summary>
    public string? ToStorageValue() =>
        IsDefault
            ? null
            : string.Join(',', _order.Select(key => _hidden.Contains(key) ? $"{HiddenMark}{key}" : key));

    /// <summary>
    ///     Every declared column, in the order this layout puts it, each saying whether it is shown.
    /// </summary>
    public IReadOnlyList<KColumnState> Resolve(IReadOnlyList<KColumnDefinition> definitions)
    {
        var declared = new Dictionary<string, KColumnDefinition>(StringComparer.Ordinal);

        foreach (var definition in definitions)
        {
            declared[definition.Key] = definition;
        }

        // What was arranged comes first, in the order it was arranged; then whatever this layout
        // never mentioned, in the place it was declared in.
        var ordered = _order.Where(declared.ContainsKey).ToList();

        ordered.AddRange(definitions
            .Select(definition => definition.Key)
            .Where(key => !ordered.Contains(key, StringComparer.Ordinal)));

        return ordered
            .Select(key => new KColumnState(
                key,
                declared[key].Title,
                !_hidden.Contains(key) || !declared[key].CanBeHidden,
                declared[key].CanBeHidden))
            .ToList();
    }

    /// <summary>The columns actually shown, in order.</summary>
    public IReadOnlyList<KColumnState> Visible(IReadOnlyList<KColumnDefinition> definitions) =>
        Resolve(definitions).Where(column => column.IsVisible).ToList();

    /// <summary>Shows or hides a column. A column that identifies the row stays.</summary>
    public KColumnLayout Toggle(string key, IReadOnlyList<KColumnDefinition> definitions)
    {
        if (definitions.FirstOrDefault(definition => definition.Key == key) is not { CanBeHidden: true })
        {
            return this;
        }

        var hidden = new HashSet<string>(_hidden, StringComparer.Ordinal);

        if (!hidden.Remove(key))
        {
            hidden.Add(key);
        }

        return new KColumnLayout(Keys(definitions), hidden);
    }

    /// <summary>
    ///     Moves a column one place towards the front or the back. At either end nothing happens,
    ///     which is what makes holding the button down safe.
    /// </summary>
    public KColumnLayout Move(string key, int offset, IReadOnlyList<KColumnDefinition> definitions)
    {
        var order = Keys(definitions);
        var from = order.IndexOf(key);
        var to = from + offset;

        if (from < 0 || to < 0 || to >= order.Count)
        {
            return this;
        }

        order.RemoveAt(from);
        order.Insert(to, key);

        return new KColumnLayout(order, _hidden);
    }

    /// <summary>Back to the declared order, with everything shown.</summary>
    public KColumnLayout Reset() => new();

    private List<string> Keys(IReadOnlyList<KColumnDefinition> definitions) =>
        Resolve(definitions).Select(column => column.Key).ToList();
}
