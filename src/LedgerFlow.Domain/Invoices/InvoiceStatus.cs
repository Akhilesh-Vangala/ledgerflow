namespace LedgerFlow.Domain.Invoices;

public enum InvoiceStatus
{
    Draft = 0,
    Submitted = 1,
    Approved = 2,
    Rejected = 3,
    Scheduled = 4,
    Paid = 5,
}

public enum InvoiceEventType
{
    Created = 0,
    Updated = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Scheduled = 5,
    Paid = 6,
    Unscheduled = 7,
    FlaggedOverdue = 8,
}
