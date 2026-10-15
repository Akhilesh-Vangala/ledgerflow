using LedgerFlow.Application.Abstractions;
using LedgerFlow.Application.Dashboard;
using LedgerFlow.Application.Notifications;
using LedgerFlow.Application.Reporting;
using LedgerFlow.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LedgerFlow.Api.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public sealed class DashboardController(DashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public Task<DashboardDto> Get(CancellationToken ct) => dashboard.GetAsync(ct);
}

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(NotificationService notifications) : ControllerBase
{
    [HttpGet]
    public Task<NotificationFeedDto> Feed(CancellationToken ct) => notifications.FeedAsync(ct);

    [HttpPost("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, CancellationToken ct)
    {
        await notifications.MarkReadAsync(id, ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await notifications.MarkAllReadAsync(ct);
        return NoContent();
    }
}

public sealed record TriggeredJobDto(string RecurringJobId, string BackgroundJobId);

[ApiController]
[Route("api/jobs")]
[Authorize(Roles = Roles.Controller)]
public sealed class JobsController(IJobScheduler scheduler) : ControllerBase
{
    [HttpGet]
    public IReadOnlyList<RecurringJobInfo> List() => scheduler.GetRecurringJobs();

    [HttpPost("{id}/trigger")]
    public ActionResult<TriggeredJobDto> Trigger(string id) =>
        Accepted(new TriggeredJobDto(id, scheduler.TriggerNow(id)));
}

[ApiController]
[Route("api/reports")]
[Authorize]
public sealed class ReportsController(ReportService reports) : ControllerBase
{
    [HttpGet("capabilities")]
    public ReportCapabilitiesDto Capabilities() => reports.Capabilities();

    [HttpGet("archive")]
    public Task<IReadOnlyList<ReportArchiveDto>> Archive(CancellationToken ct) => reports.ArchiveAsync(ct);

    [HttpGet("archive/{id:int}")]
    public async Task<IActionResult> DownloadArchived(int id, CancellationToken ct)
    {
        var file = await reports.DownloadArchivedAsync(id, ct);
        return File(file.Content, file.ContentType, file.FileName);
    }

    /// <summary>Renders a report on demand. Query string values become report parameters (from, to, paymentRunId).</summary>
    [HttpGet("{name}.{format}")]
    public async Task<IActionResult> Render(string name, string format, CancellationToken ct)
    {
        var parameters = Request.Query.ToDictionary(q => q.Key, q => (string?)q.Value.ToString(), StringComparer.OrdinalIgnoreCase);
        var file = await reports.RenderAsync(name, format, parameters, ct);
        return File(file.Content, file.ContentType, file.FileName);
    }
}
