using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ScaffoldTest.Api.Contracts;
using ScaffoldTest.Api.Data;
using ScaffoldTest.Api.Models;

namespace ScaffoldTest.Api.Controllers;

/// <remarks>
/// Log statements use structured logging with typed route parameters (e.g. int id) only.
/// User-provided strings such as project names are intentionally excluded to prevent log-forging.
/// </remarks>
[ApiController]
[Route("api/[controller]")]
public class ProjectsController(ScaffoldTestDbContext dbContext, ILogger<ProjectsController> logger) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Project>>> GetAll()
    {
        logger.LogInformation("Retrieving all projects");

        var projects = await dbContext.Projects
            .AsNoTracking()
            .OrderBy(project => project.Name)
            .ToListAsync();

        logger.LogInformation("Retrieved {Count} projects", projects.Count);

        return Ok(projects);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Project>> GetById(int id)
    {
        logger.LogInformation("Retrieving project {ProjectId}", id);

        var project = await dbContext.Projects
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id);

        if (project is null)
        {
            logger.LogWarning("Project {ProjectId} not found", id);
            return NotFound();
        }

        return Ok(project);
    }

    [HttpPost]
    public async Task<ActionResult<Project>> Create([FromBody] ProjectRequest request)
    {
        var trimmedName = request.Name.Trim();

        if (trimmedName.Length == 0)
        {
            ModelState.AddModelError(nameof(request.Name), "Project name is required.");
            return ValidationProblem(ModelState);
        }

        var duplicateName = await HasDuplicateNameAsync(trimmedName);

        if (duplicateName)
        {
            logger.LogWarning("Project creation failed due to duplicate name");
            return Conflict(new { message = "A project with this name already exists." });
        }

        var project = new Project
        {
            Name = trimmedName
        };

        dbContext.Projects.Add(project);
        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            var isDuplicateName = await HasDuplicateNameAsync(trimmedName);

            if (isDuplicateName)
            {
                logger.LogWarning("Project creation failed due to concurrent duplicate name");
                return Conflict(new { message = "A project with this name already exists." });
            }

            throw;
        }

        logger.LogInformation("Created project {ProjectId}", project.Id);

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<Project>> Update(int id, [FromBody] ProjectRequest request)
    {
        var project = await dbContext.Projects.FirstOrDefaultAsync(item => item.Id == id);

        if (project is null)
        {
            logger.LogWarning("Project {ProjectId} not found for update", id);
            return NotFound();
        }

        var trimmedName = request.Name.Trim();

        if (trimmedName.Length == 0)
        {
            ModelState.AddModelError(nameof(request.Name), "Project name is required.");
            return ValidationProblem(ModelState);
        }

        var duplicateName = await HasDuplicateNameAsync(trimmedName, id);

        if (duplicateName)
        {
            logger.LogWarning("Project {ProjectId} update failed due to duplicate name", id);
            return Conflict(new { message = "A project with this name already exists." });
        }

        project.Name = trimmedName;

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            var isDuplicateName = await HasDuplicateNameAsync(trimmedName, id);

            if (isDuplicateName)
            {
                logger.LogWarning("Project {ProjectId} update failed due to concurrent duplicate name", id);
                return Conflict(new { message = "A project with this name already exists." });
            }

            throw;
        }

        logger.LogInformation("Updated project {ProjectId}", id);

        return Ok(project);
    }

    private async Task<bool> HasDuplicateNameAsync(string name, int? excludeId = null)
    {
        var query = dbContext.Projects.AsNoTracking();

        if (excludeId is int id)
        {
            query = query.Where(item => item.Id != id);
        }

        return dbContext.Database.IsSqlServer()
            ? await query.AnyAsync(item => item.Name == name)
            : await query.AnyAsync(item =>
                string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var project = await dbContext.Projects.FirstOrDefaultAsync(item => item.Id == id);

        if (project is null)
        {
            logger.LogWarning("Project {ProjectId} not found for deletion", id);
            return NotFound();
        }

        dbContext.Projects.Remove(project);
        await dbContext.SaveChangesAsync();

        logger.LogInformation("Deleted project {ProjectId}", id);

        return NoContent();
    }
}
