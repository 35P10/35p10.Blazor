using Microsoft.JSInterop;

namespace k35p10.Blazor;

/// <summary>
///     Puts text on the clipboard, and says whether it got there. Nothing to register: it is one
///     call, and hiding it behind a service would only add a registration to forget.
/// </summary>
public static class KClipboard
{
    private const string ModulePath = "./_content/35p10.Blazor/util/clipboard.js";

    /// <summary>
    ///     Copies <paramref name="text" />. False when the browser would not allow it — an insecure
    ///     context, or a gesture it did not recognise — so the caller can say so instead of
    ///     claiming success.
    /// </summary>
    public static async Task<bool> CopyAsync(IJSRuntime js, string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return false;
        }

        try
        {
            await using var module = await js.InvokeAsync<IJSObjectReference>("import", ModulePath);

            return await module.InvokeAsync<bool>("copyText", text);
        }
        catch (JSDisconnectedException)
        {
            return false;
        }
        catch (JSException)
        {
            return false;
        }
    }
}
