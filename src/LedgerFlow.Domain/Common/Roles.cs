namespace LedgerFlow.Domain.Common;

/// <summary>
/// Accounts-payable roles. Clerks capture invoices, approvers sign off up to <see cref="ApprovalPolicy.ApproverLimit"/>,
/// controllers approve anything, release payment runs, and own reporting and jobs.
/// </summary>
public static class Roles
{
    public const string Clerk = "Clerk";
    public const string Approver = "Approver";
    public const string Controller = "Controller";

    public const string ApproversAndControllers = Approver + "," + Controller;

    public static readonly IReadOnlyList<string> All = [Clerk, Approver, Controller];
}

public static class ApprovalPolicy
{
    /// <summary>Invoices above this total need a controller's approval.</summary>
    public const decimal ApproverLimit = 10_000m;
}
