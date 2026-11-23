using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using ScaffoldTest.Api.Authentication;
using ScaffoldTest.Api.Data;

namespace ScaffoldTest.Api.Tests;

internal static class TestDb
{
    // The user the controller tests act as, unless a test signs in as someone else.
    public const int UserId = 1;

    public const int OtherUserId = 2;

    public static ScaffoldTestDbContext Create(string? databaseName = null, int userId = UserId, params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<ScaffoldTestDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString())
            .AddInterceptors(interceptors)
            .Options;

        return new ScaffoldTestDbContext(options, new CurrentUser { UserId = userId });
    }
}
