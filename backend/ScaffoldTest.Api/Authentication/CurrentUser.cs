namespace ScaffoldTest.Api.Authentication;

/// <summary>
/// The signed-in user of the current request, set by <see cref="CurrentUserMiddleware"/>. Null when nobody is signed in,
/// in which case no projects or runs are visible.
/// </summary>
public class CurrentUser
{
    public int? UserId { get; set; }
}
