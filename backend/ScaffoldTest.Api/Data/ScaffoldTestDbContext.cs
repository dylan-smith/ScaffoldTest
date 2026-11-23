using Microsoft.EntityFrameworkCore;
using ScaffoldTest.Api.Authentication;
using ScaffoldTest.Api.Models;

namespace ScaffoldTest.Api.Data;

/// <remarks>
/// Projects belong to a user. A query filter only shows the current user's, and new ones are given the current user
/// when they're saved, so the controllers never handle the owner themselves.
/// </remarks>
public class ScaffoldTestDbContext(DbContextOptions<ScaffoldTestDbContext> options, CurrentUser currentUser) : DbContext(options)
{
    // Read by the query filters each time a query runs, so it's this request's user.
    private int? CurrentUserId => currentUser.UserId;

    public DbSet<User> Users => Set<User>();

    public DbSet<Project> Projects => Set<Project>();

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        AssignOwner();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        AssignOwner();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void AssignOwner()
    {
        foreach (var entry in ChangeTracker.Entries().Where(entry => entry.State == EntityState.Added))
        {
            if (entry.Entity is Project project)
            {
                project.UserId = CurrentUserId ?? throw NoCurrentUser();
            }
        }

        static InvalidOperationException NoCurrentUser()
        {
            return new("Projects can only be saved for a signed-in user.");
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(user => user.Subject)
            .IsUnique();

        modelBuilder.Entity<User>()
            .Property(user => user.Subject)
            .HasMaxLength(255)
            .IsRequired();

        modelBuilder.Entity<User>()
            .Property(user => user.Email)
            .HasMaxLength(320);

        modelBuilder.Entity<User>()
            .Property(user => user.DisplayName)
            .HasMaxLength(200);

        modelBuilder.Entity<Project>()
            .HasQueryFilter(project => project.UserId == CurrentUserId);

        modelBuilder.Entity<Project>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(project => project.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Names only have to be unique among one user's projects.
        modelBuilder.Entity<Project>()
            .HasIndex(project => new { project.UserId, project.Name })
            .IsUnique();

        modelBuilder.Entity<Project>()
            .Property(project => project.Name)
            .HasMaxLength(200)
            .IsRequired();
    }
}
