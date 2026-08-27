namespace k35p10.Blazor;

/// <summary>
///     Dirección y apertura de la cámara de un visor 360, en grados.
///
///     El yaw está en el mismo sistema que usan los shaders para muestrear la textura, así que el
///     mismo valor apunta al mismo sitio de la escena en los tres visores (esfera, cubo y ECP).
/// </summary>
public sealed record CameraView(double Yaw, double Pitch, double Fov)
{
    /// <summary>Dos cámaras se dan por iguales si no se distinguen en pantalla.</summary>
    public bool Matches(double? yaw, double? pitch, double? fov) =>
        Close(Yaw, yaw) && Close(Pitch, pitch) && Close(Fov, fov);

    private static bool Close(double value, double? other) =>
        other is null || Math.Abs(value - other.Value) < 0.05d;
}
