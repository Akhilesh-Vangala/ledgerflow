namespace LedgerFlow.Application.Reporting;

public sealed class ApAgingRow
{
    public int InvoiceId { get; set; }

    public string InvoiceNumber { get; set; } = string.Empty;

    public int VendorId { get; set; }

    public string VendorName { get; set; } = string.Empty;

    public DateOnly InvoiceDate { get; set; }

    public DateOnly DueDate { get; set; }

    public string Status { get; set; } = string.Empty;

    public decimal Outstanding { get; set; }

    public int DaysPastDue { get; set; }

    public string Bucket { get; set; } = string.Empty;

    public int BucketOrder { get; set; }
}

public sealed class VendorSpendRow
{
    public int VendorId { get; set; }

    public string VendorName { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public DateOnly PeriodStart { get; set; }

    public int InvoiceCount { get; set; }

    public decimal TotalAmount { get; set; }
}

public sealed class PaymentRemittanceRow
{
    public int PaymentId { get; set; }

    public int PaymentRunId { get; set; }

    public string RunName { get; set; } = string.Empty;

    public DateOnly PaymentDate { get; set; }

    public string RunStatus { get; set; } = string.Empty;

    public string VendorName { get; set; } = string.Empty;

    public string VendorEmail { get; set; } = string.Empty;

    public string InvoiceNumber { get; set; } = string.Empty;

    public DateOnly InvoiceDate { get; set; }

    public decimal Amount { get; set; }

    public string? Reference { get; set; }
}

public static class ReportNames
{
    public const string ApAging = "ApAging";
    public const string VendorSpend = "VendorSpend";
    public const string PaymentRemittance = "PaymentRemittance";

    public static readonly IReadOnlyList<ReportDefinition> All =
    [
        new(ApAging, "AP aging", "Open payables by days past due: not yet due, 1-30, 31-60, 61-90 and 90+.", []),
        new(VendorSpend, "Vendor spend", "Monthly invoiced spend by vendor and category.", ["from", "to"]),
        new(PaymentRemittance, "Payment remittance", "Remittance advice for a released payment run.", ["paymentRunId"]),
    ];
}

public sealed record ReportDefinition(string Name, string Title, string Description, IReadOnlyList<string> Parameters);
