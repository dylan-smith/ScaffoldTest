using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using ScaffoldTest.Api.Contracts;
using ScaffoldTest.Api.Controllers;
using ScaffoldTest.Api.Data;
using ScaffoldTest.Api.Models;

namespace ScaffoldTest.Api.Tests;

public class ProjectsControllerTests
{
    [Fact]
    public async Task Create_ReturnsConflict_WhenNameAlreadyExists()
    {
        await using var dbContext = CreateDbContext();
        dbContext.Projects.Add(new Project { Name = "Daily" });
        await dbContext.SaveChangesAsync();

        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Create(new ProjectRequest { Name = "daily" });

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Create_TrimsName_AndPersistsProject()
    {
        await using var dbContext = CreateDbContext();
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Create(new ProjectRequest { Name = "  Weekly  " });

        var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
        var project = Assert.IsType<Project>(createdResult.Value);
        Assert.Equal("Weekly", project.Name);

        var savedProject = await dbContext.Projects.SingleAsync();
        Assert.Equal("Weekly", savedProject.Name);
    }

    [Fact]
    public async Task Update_ReturnsConflict_WhenAnotherProjectUsesName()
    {
        await using var dbContext = CreateDbContext();
        dbContext.Projects.AddRange(
            new Project { Name = "Morning" },
            new Project { Name = "Evening" });
        await dbContext.SaveChangesAsync();

        var morning = await dbContext.Projects.SingleAsync(item => item.Name == "Morning");
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Update(morning.Id, new ProjectRequest { Name = "evening" });

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Update_ReturnsOk_AndUpdatesProject()
    {
        await using var dbContext = CreateDbContext();
        var project = new Project { Name = "Morning" };
        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();

        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Update(project.Id, new ProjectRequest { Name = "  Workday  " });

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var updatedProject = Assert.IsType<Project>(okResult.Value);
        Assert.Equal("Workday", updatedProject.Name);

        var savedProject = await dbContext.Projects.SingleAsync(item => item.Id == project.Id);
        Assert.Equal("Workday", savedProject.Name);
    }

    [Fact]
    public async Task GetAll_ReturnsProjectsOrderedByName()
    {
        await using var dbContext = CreateDbContext();
        dbContext.Projects.AddRange(
            new Project { Name = "Zulu" },
            new Project { Name = "Alpha" });
        await dbContext.SaveChangesAsync();

        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var projects = Assert.IsAssignableFrom<IEnumerable<Project>>(okResult.Value).ToList();

        Assert.Equal(2, projects.Count);
        Assert.Collection(projects,
            project => Assert.Equal("Alpha", project.Name),
            project => Assert.Equal("Zulu", project.Name));
    }

    [Fact]
    public async Task GetById_ReturnsProject_WhenProjectExists()
    {
        await using var dbContext = CreateDbContext();
        var project = new Project { Name = "Daily" };
        dbContext.Projects.AddRange(project, new Project { Name = "Other" });
        await dbContext.SaveChangesAsync();

        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.GetById(project.Id);

        var okResult = Assert.IsType<OkObjectResult>(result.Result);
        var returnedProject = Assert.IsType<Project>(okResult.Value);
        Assert.Equal(project.Id, returnedProject.Id);
        Assert.Equal("Daily", returnedProject.Name);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_WhenProjectDoesNotExist()
    {
        await using var dbContext = CreateDbContext();
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.GetById(999);

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Delete_ReturnsNoContent_AndRemovesProject()
    {
        await using var dbContext = CreateDbContext();
        var project = new Project { Name = "Daily" };
        dbContext.Projects.Add(project);
        await dbContext.SaveChangesAsync();

        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Delete(project.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.False(await dbContext.Projects.AnyAsync(item => item.Id == project.Id));
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_WhenProjectDoesNotExist()
    {
        await using var dbContext = CreateDbContext();
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Delete(999);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task Create_GivesTheProjectToTheCurrentUser()
    {
        await using var dbContext = CreateDbContext();
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        await controller.Create(new ProjectRequest { Name = "Weekly" });

        Assert.Equal(TestDb.UserId, (await dbContext.Projects.SingleAsync()).UserId);
    }

    [Fact]
    public async Task Create_AllowsANameAnotherUserHas()
    {
        var databaseName = Guid.NewGuid().ToString();
        await using (var otherContext = TestDb.Create(databaseName, TestDb.OtherUserId))
        {
            otherContext.Projects.Add(new Project { Name = "Daily" });
            await otherContext.SaveChangesAsync();
        }

        await using var dbContext = TestDb.Create(databaseName);
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var result = await controller.Create(new ProjectRequest { Name = "Daily" });

        Assert.IsType<CreatedAtActionResult>(result.Result);
    }

    [Fact]
    public async Task OtherUsersProjects_AreNotListedOrFound()
    {
        var databaseName = Guid.NewGuid().ToString();
        int otherId;
        await using (var otherContext = TestDb.Create(databaseName, TestDb.OtherUserId))
        {
            var other = new Project { Name = "Theirs" };
            otherContext.Projects.Add(other);
            await otherContext.SaveChangesAsync();
            otherId = other.Id;
        }

        await using var dbContext = TestDb.Create(databaseName);
        var controller = new ProjectsController(dbContext, NullLogger<ProjectsController>.Instance);

        var all = Assert.IsType<OkObjectResult>((await controller.GetAll()).Result);
        Assert.Empty(Assert.IsAssignableFrom<IEnumerable<Project>>(all.Value));
        Assert.IsType<NotFoundResult>((await controller.GetById(otherId)).Result);
        Assert.IsType<NotFoundResult>((await controller.Update(otherId, new ProjectRequest { Name = "Mine" })).Result);
        Assert.IsType<NotFoundResult>(await controller.Delete(otherId));
    }

    private static ScaffoldTestDbContext CreateDbContext()
    {
        return TestDb.Create();
    }
}
