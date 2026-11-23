using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ScaffoldTest.Api.Models;

public class Project
{
    public int Id { get; set; }

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    // The project is returned as it is, and callers only ever see their own, so the owner isn't part of it.
    [JsonIgnore]
    public int UserId { get; set; }
}
