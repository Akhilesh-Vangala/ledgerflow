using LedgerFlow.Application.Reporting;
using LedgerFlow.Domain.Invoices;
using LedgerFlow.Domain.Operations;
using LedgerFlow.Domain.Payments;
using LedgerFlow.Domain.Vendors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace LedgerFlow.Application.Abstractions;

/// <summary>Persistence boundary for the application layer; implemented by the EF Core DbContext.</summary>
public interface ILedgerFlowDb
{
    DbSet<Vendor> Vendors { get; }

    DbSet<Invoice> Invoices { get; }

    DbSet<InvoiceEvent> InvoiceEvents { get; }

    DbSet<PaymentRun> PaymentRuns { get; }

    DbSet<Payment> Payments { get; }

    DbSet<Notification> Notifications { get; }

    DbSet<AgingSnapshot> AgingSnapshots { get; }

    DbSet<ReportArchive> ReportArchives { get; }

    /// <summary>Keyless projection of the <c>vw_ApAging</c> SQL view.</summary>
    IQueryable<ApAgingRow> ApAging { get; }

    /// <summary>Keyless projection of the <c>vw_VendorSpend</c> SQL view.</summary>
    IQueryable<VendorSpendRow> VendorSpend { get; }

    /// <summary>Keyless projection of the <c>vw_PaymentRemittance</c> SQL view.</summary>
    IQueryable<PaymentRemittanceRow> PaymentRemittance { get; }

    DatabaseFacade Database { get; }

    EntityEntry<TEntity> Entry<TEntity>(TEntity entity)
        where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

/// <summary>The authenticated caller. Jobs run as a named system actor.</summary>
public interface ICurrentUser
{
    string Email { get; }

    IReadOnlyCollection<string> Roles { get; }

    bool IsAuthenticated { get; }
}

/// <summary>Background job scheduling, implemented with Hangfire.</summary>
public interface IJobScheduler
{
    void EnqueueInvoiceDecisionNotification(int invoiceId);

    IReadOnlyList<RecurringJobInfo> GetRecurringJobs();

    /// <summary>Triggers a recurring job immediately and returns the background job id.</summary>
    string TriggerNow(string recurringJobId);
}

public sealed record RecurringJobInfo(
    string Id,
    string Description,
    string Cron,
    DateTimeOffset? LastExecution,
    string? LastJobState,
    DateTimeOffset? NextExecution);

/// <summary>Renders a named report. Telerik produces PDF; the fallback produces CSV.</summary>
public interface IReportRenderer
{
    string Engine { get; }

    bool SupportsPdf { get; }

    Task<RenderedReport> RenderAsync(string reportName, IReadOnlyDictionary<string, object?> parameters, CancellationToken cancellationToken);
}

public sealed record RenderedReport(string FileName, string ContentType, byte[] Content);

public sealed class NotFoundException : Exception
{
    public NotFoundException()
    {
    }

    public NotFoundException(string message)
        : base(message)
    {
    }

    public NotFoundException(string message, Exception innerException)
        : base(message, innerException)
    {
    }

    public static NotFoundException For<T>(object id) => new($"{typeof(T).Name} {id} was not found.");
}

public static class SystemActors
{
    public const string OverdueJob = "system:overdue-job";
    public const string ReminderJob = "system:reminder-job";
    public const string AgingJob = "system:aging-job";
    public const string PaymentRunJob = "system:payment-run-job";
    public const string ReportJob = "system:report-job";
    public const string Seeder = "system:seed";
}
