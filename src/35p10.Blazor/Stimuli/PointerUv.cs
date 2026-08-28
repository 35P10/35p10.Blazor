namespace k35p10.Blazor;

/// <summary>
///     Punto de la textura bajo el puntero, en el mismo sistema que el marcador de los visores 360:
///     U de izquierda a derecha, V de abajo hacia arriba.
/// </summary>
public sealed record PointerUv(double U, double V);
