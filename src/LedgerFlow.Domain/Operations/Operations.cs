namespace LedgerFlow.Domain.Operations;

/// <summary>In-app notification produced by background jobs and workflow events.</summary>
public sealed class Notification
{
    private Notification()
    {
        Audience = string.Empty;
        Title = string.Empty;
        Body = string.Empty;
    }

    public Notification(string audience, string title, string body, string? link, DateTimeOffset createdAt)
    {
        Audience = audience;
        Title = title;
        Body = body;
        Link = link;
        CreatedAt = createdAt;
    }

    public int Id { get; private set; }

    /// <summary>A role name or a user's email.</summary>
    public string Audience { get; private set; }

    public string Title { get; private set; }

    public string Body { get; private set; }

    public string? Link { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset? ReadAt { get; private set; }

    public void MarkRead(DateTimeOffset now) => ReadAt ??= now;
}

/// <summary>Nightly point-in-time AP aging totals, used for trend charts and month-end reconciliation.</summary>
public sealed class AgingSnapshot
{
    private AgingSnapshot()
    {
        Bucket = string.Empty;
    }

    public AgingSnapshot(DateOnly snapshotDate, string bucket, int bucketOrder, int invoiceCount, decimal amount)
    {
        SnapshotDate = snapshotDate;
        Bucket = bucket;
        BucketOrder = bucketOrder;
        InvoiceCount = invoiceCount;
        Amount = amount;
    }

    public int Id { get; private set; }

    public DateOnly SnapshotDate { get; private set; }

    public string Bucket { get; private set; }

    public int BucketOrder { get; private set; }

    public int InvoiceCount { get; private set; }

    public decimal Amount { get; private set; }
}

/// <summary>A rendered report kept for audit (weekly AP aging PDF produced by Hangfire + Telerik).</summary>
public sealed class ReportArchive
{
    private ReportArchive()
    {
        ReportName = string.Empty;
        FileName = string.Empty;
        ContentType = string.Empty;
        Content = [];
        GeneratedBy = string.Empty;
    }

    public ReportArchive(string reportName, string fileName, string contentType, byte[] content, string generatedBy, DateTimeOffset generatedAt)
    {
        ReportName = reportName;
        FileName = fileName;
        ContentType = contentType;
        Content = content;
        SizeBytes = content.LongLength;
        GeneratedBy = generatedBy;
        GeneratedAt = generatedAt;
    }

    public int Id { get; private set; }

    public string ReportName { get; private set; }

    public string FileName { get; private set; }

    public string ContentType { get; private set; }

    public byte[] Content { get; private set; }

    public long SizeBytes { get; private set; }

    public string GeneratedBy { get; private set; }

    public DateTimeOffset GeneratedAt { get; private set; }
}
