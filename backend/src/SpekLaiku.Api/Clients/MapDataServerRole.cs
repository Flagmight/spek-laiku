namespace SpekLaiku.Api.Clients;

/// <summary>Which configured map data server a request is sent to (feature 017 spec FR-001, FR-002).</summary>
public enum MapDataServerRole
{
    Main,
    Fallback
}

/// <summary>The role's name in log records (feature 017 spec FR-013, research section 8).</summary>
public static class MapDataServerRoles
{
    /// <summary>
    /// <c>main</c> or <c>fallback</c>. Only this name is ever logged, never the server's address, which can hold a
    /// user name or password.
    /// </summary>
    public static string ToLogName(this MapDataServerRole role) => role switch
    {
        MapDataServerRole.Main => "main",
        MapDataServerRole.Fallback => "fallback",
        _ => role.ToString()
    };
}
