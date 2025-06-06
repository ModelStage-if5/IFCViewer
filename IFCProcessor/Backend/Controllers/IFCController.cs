using Microsoft.AspNetCore.Mvc;

namespace IFCProcessor.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IFCController : ControllerBase
{
    private readonly ILogger<IFCController> _logger;
    private readonly string _uploadPath;

    public IFCController(ILogger<IFCController> logger, IConfiguration configuration)
    {
        _logger = logger;
        _uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        
        // Ensure upload directory exists
        if (!Directory.Exists(_uploadPath))
        {
            Directory.CreateDirectory(_uploadPath);
        }
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadIFCFile(IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded");
            }

            // Validate file extension
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (extension != ".ifc")
            {
                return BadRequest("Only IFC files are allowed");
            }

            // Generate unique filename
            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(_uploadPath, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            _logger.LogInformation($"IFC file uploaded: {fileName}");

            return Ok(new
            {
                success = true,
                fileName = fileName,
                originalName = file.FileName,
                size = file.Length,
                uploadPath = filePath
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading IFC file");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("files")]
    public IActionResult GetUploadedFiles()
    {
        try
        {
            var files = Directory.GetFiles(_uploadPath, "*.ifc")
                .Select(f => new
                {
                    fileName = Path.GetFileName(f),
                    size = new FileInfo(f).Length,
                    uploadDate = new FileInfo(f).CreationTime
                })
                .OrderByDescending(f => f.uploadDate)
                .ToList();

            return Ok(files);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving uploaded files");
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpGet("download/{fileName}")]
    public IActionResult DownloadFile(string fileName)
    {
        try
        {
            var filePath = Path.Combine(_uploadPath, fileName);
            
            if (!System.IO.File.Exists(filePath))
            {
                return NotFound("File not found");
            }

            var fileBytes = System.IO.File.ReadAllBytes(filePath);
            return File(fileBytes, "application/octet-stream", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading file");
            return StatusCode(500, "Internal server error");
        }
    }
}