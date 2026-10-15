using System.Globalization;
using LedgerFlow.Application.Abstractions;
using LedgerFlow.Application.Dashboard;
using LedgerFlow.Application.Payments;
using LedgerFlow.Application.Reporting;
using LedgerFlow.Domain.Common;
using LedgerFlow.Domain.Invoices;
using LedgerFlow.Domain.Operations;
using LedgerFlow.Domain.Payments;
using Microsoft.EntityFrameworkCore;

namespace LedgerFlow.Application.Jobs;

/// <summary>Recurring job ids and schedules (cron, UTC). Hangfire registration reads from here.</summary>
public static class JobCatalog
{
    public const string OverdueInvoices = "overdue-invoices";
    public const string PaymentReminders = "payment-reminders";
    public const string AgingSnapshot = "aging-snapshot";
    public const string AutoPaymentRun = "auto-payment-run";
    public const string WeeklyAgingReport = "weekly-aging-report";

    public static readonly IReadOnlyDictionary<string, (string Cron, string Description)> Recurring =
        new Dictionary<string, (string, string)>
        {
            [OverdueInvoices] = ("0 6 * * *", "Flags unpaid invoices past their due date and alerts AP."),
            [PaymentReminders] = ("15 6 * * *", "Reminds controllers about approved invoices due within 7 days."),
            [AgingSnapshot] = ("30 23 * * *", "Stores tonight's AP aging buckets for trend reporting (idempotent)."),
            [AutoPaymentRun] = ("0 7 * * 1", "Drafts Monday's payment run from approved invoices due within 10 days."),
            [WeeklyAgingReport] = ("0 8 * * 1", "Renders the AP aging report and files it in the report archive."),
        };
}

public sealed class OverdueInvoiceJob(ILedgerFlowDb db, TimeProvider time)
{
    /// <returns>Number of invoices newly flagged overdue.</returns>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var candidates = await db.Invoices
            .Where(i => i.IsOverdue || (i.DueDate < today && (i.Status == InvoiceStatus.Submitted || i.Status == InvoiceStatus.Approved || i.Status == InvoiceStatus.Scheduled)))
            .ToListAsync(ct);

        var newlyOverdue = candidates.Where(i => i.RefreshOverdue(today, now) && i.IsOverdue).ToList();
        if (newlyOverdue.Count > 0)
        {
            var amount = newlyOverdue.Sum(i => i.Outstanding);
            foreach (var audience in new[] { Roles.Clerk, Roles.Controller })
            {
                db.Notifications.Add(new Notification(
                    audience,
                    $"{newlyOverdue.Count} invoice(s) went overdue",
                    $"{amount.ToString("C", CultureInfo.GetCultureInfo("en-US"))} is now past due. Oldest: {newlyOverdue.MinBy(i => i.DueDate)!.InvoiceNumber}.",
                    "/invoices?overdue=true",
                    now));
            }
        }

        await db.SaveChangesAsync(ct);
        return newlyOverdue.Count;
    }
}

public sealed class PaymentReminderJob(ILedgerFlowDb db, TimeProvider time)
{
    public const int WindowDays = 7;

    /// <returns>Number of invoices in the reminder, or 0 when nothing was sent.</returns>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var horizon = today.AddDays(WindowDays);
        var due = await db.Invoices.AsNoTracking()
            .Where(i => i.Status == InvoiceStatus.Approved && i.PaymentRunId == null && i.DueDate <= horizon)
            .Select(i => new { i.Total, i.AmountPaid })
            .ToListAsync(ct);
        if (due.Count == 0)
        {
            return 0;
        }

        var title = $"Payments due by {horizon:MMM d}";
        var startOfDay = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        if (await db.Notifications.AnyAsync(n => n.Title == title && n.CreatedAt >= startOfDay, ct))
        {
            return 0;
        }

        var amount = due.Sum(i => i.Total - i.AmountPaid);
        db.Notifications.Add(new Notification(
            Roles.Controller,
            title,
            $"{due.Count} approved invoice(s) totalling {amount.ToString("C", CultureInfo.GetCultureInfo("en-US"))} are not in a payment run yet.",
            "/payment-runs/new",
            now));
        await db.SaveChangesAsync(ct);
        return due.Count;
    }
}

public sealed class AgingSnapshotJob(ILedgerFlowDb db, TimeProvider time)
{
    /// <summary>Replaces today's snapshot so re-runs and retries never double count.</summary>
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
        var rows = await db.ApAging
            .GroupBy(a => new { a.Bucket, a.BucketOrder })
            .Select(g => new { g.Key.Bucket, g.Key.BucketOrder, Count = g.Count(), Amount = g.Sum(a => a.Outstanding) })
            .ToListAsync(ct);

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.AgingSnapshots.Where(s => s.SnapshotDate == today).ExecuteDeleteAsync(ct);
            foreach (var (bucket, order) in DashboardService.Buckets)
            {
                var row = rows.FirstOrDefault(r => r.Bucket == bucket);
                db.AgingSnapshots.Add(new AgingSnapshot(today, bucket, order, row?.Count ?? 0, row?.Amount ?? 0));
            }

            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return DashboardService.Buckets.Count;
    }
}

public sealed class AutoPaymentRunJob(ILedgerFlowDb db, PaymentRunService runs, TimeProvider time)
{
    public const int HorizonDays = 10;

    /// <returns>The drafted run id, or null when there was nothing to draft or a draft already awaits release.</returns>
    public async Task<int?> RunAsync(CancellationToken ct)
    {
        if (await db.PaymentRuns.AnyAsync(r => r.Status == PaymentRunStatus.Draft, ct))
        {
            return null;
        }

        var now = time.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var ids = await db.Invoices
            .Where(i => i.Status == InvoiceStatus.Approved && i.PaymentRunId == null && i.DueDate <= today.AddDays(HorizonDays))
            .OrderBy(i => i.DueDate)
            .Select(i => i.Id)
            .ToListAsync(ct);
        if (ids.Count == 0)
        {
            return null;
        }

        var paymentDate = NextBusinessDay(today.AddDays(2));
        var runId = await runs.DraftAsync($"Auto run {today:yyyy-MM-dd}", paymentDate, ids, SystemActors.PaymentRunJob, ct);
        db.Notifications.Add(new Notification(
            Roles.Controller,
            "Payment run ready for release",
            $"{ids.Count} approved invoice(s) were drafted into a run paying on {paymentDate:MMM d}. Review and release it.",
            $"/payment-runs/{runId}",
            now));
        await db.SaveChangesAsync(ct);
        return runId;
    }

    private static DateOnly NextBusinessDay(DateOnly date) => date.DayOfWeek switch
    {
        DayOfWeek.Saturday => date.AddDays(2),
        DayOfWeek.Sunday => date.AddDays(1),
        _ => date,
    };
}

public sealed class WeeklyAgingReportJob(ILedgerFlowDb db, ReportService reports, TimeProvider time)
{
    public async Task<int> RunAsync(CancellationToken ct)
    {
        var archiveId = await reports.RenderAndArchiveAsync(ReportNames.ApAging, new Dictionary<string, object?>(), SystemActors.ReportJob, ct);
        db.Notifications.Add(new Notification(
            Roles.Controller,
            "Weekly AP aging report filed",
            "This week's AP aging report is in the report archive.",
            "/reports",
            time.GetUtcNow()));
        await db.SaveChangesAsync(ct);
        return archiveId;
    }
}

/// <summary>Fire-and-forget job enqueued after an approval decision so the clerk hears back without blocking the request.</summary>
public sealed class InvoiceDecisionNotificationJob(ILedgerFlowDb db, TimeProvider time)
{
    public async Task RunAsync(int invoiceId, CancellationToken ct)
    {
        var invoice = await db.Invoices.AsNoTracking()
            .Include(i => i.Events)
            .SingleOrDefaultAsync(i => i.Id == invoiceId, ct);
        var decision = invoice?.Events
            .Where(e => e.Type is InvoiceEventType.Approved or InvoiceEventType.Rejected)
            .MaxBy(e => e.OccurredAt);
        if (invoice?.CreatedBy is null || decision is null)
        {
            return;
        }

        var verb = decision.Type == InvoiceEventType.Approved ? "approved" : "rejected";
        var body = $"{decision.Actor} {verb} invoice {invoice.InvoiceNumber}.";
        if (!string.IsNullOrWhiteSpace(decision.Comment))
        {
            body += $" \"{decision.Comment}\"";
        }

        db.Notifications.Add(new Notification(invoice.CreatedBy, $"Invoice {invoice.InvoiceNumber} {verb}", body, $"/invoices/{invoice.Id}", time.GetUtcNow()));
        await db.SaveChangesAsync(ct);
    }
}
