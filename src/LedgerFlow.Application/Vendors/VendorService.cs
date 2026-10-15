using FluentValidation;
using LedgerFlow.Application.Abstractions;
using LedgerFlow.Application.Common;
using LedgerFlow.Domain.Common;
using LedgerFlow.Domain.Invoices;
using LedgerFlow.Domain.Vendors;
using Microsoft.EntityFrameworkCore;

namespace LedgerFlow.Application.Vendors;

public sealed record VendorDto(
    int Id,
    string Name,
    string TaxId,
    string Email,
    string Category,
    int PaymentTermsDays,
    bool IsActive,
    decimal OpenBalance,
    int OpenInvoices,
    string RowVersion);

public sealed record SaveVendorRequest(string Name, string TaxId, string Email, string Category, int PaymentTermsDays, string? RowVersion = null);

public sealed record VendorQuery(string? Search = null, bool IncludeInactive = false, int Page = 1, int PageSize = 25);

public sealed class SaveVendorValidator : AbstractValidator<SaveVendorRequest>
{
    public static readonly IReadOnlyList<string> Categories =
        ["Software", "Cloud", "Facilities", "Professional Services", "Marketing", "Hardware", "Logistics", "Utilities"];

    public SaveVendorValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TaxId).NotEmpty().Matches(@"^\d{2}-\d{7}$").WithMessage("Tax ID must look like 12-3456789.");
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Category).NotEmpty().Must(c => Categories.Contains(c)).WithMessage("Unknown category.");
        RuleFor(x => x.PaymentTermsDays).InclusiveBetween(0, 120);
    }
}

public sealed class VendorService(ILedgerFlowDb db, IValidator<SaveVendorRequest> validator)
{
    public async Task<PagedResult<VendorDto>> ListAsync(VendorQuery query, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(query);
        var vendors = db.Vendors.AsNoTracking();
        if (!query.IncludeInactive)
        {
            vendors = vendors.Where(v => v.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            vendors = vendors.Where(v => v.Name.Contains(term) || v.TaxId.Contains(term) || v.Email.Contains(term));
        }

        return await Project(vendors.OrderBy(v => v.Name)).ToPagedAsync(query.Page, query.PageSize, ct);
    }

    public async Task<VendorDto> GetAsync(int id, CancellationToken ct) =>
        await Project(db.Vendors.AsNoTracking().Where(v => v.Id == id)).SingleOrDefaultAsync(ct)
        ?? throw NotFoundException.For<Vendor>(id);

    public async Task<VendorDto> CreateAsync(SaveVendorRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        await EnsureTaxIdUniqueAsync(request.TaxId, null, ct);
        var vendor = new Vendor(request.Name.Trim(), request.TaxId, request.Email.Trim(), request.Category, request.PaymentTermsDays);
        db.Vendors.Add(vendor);
        await db.SaveChangesAsync(ct);
        return await GetAsync(vendor.Id, ct);
    }

    public async Task<VendorDto> UpdateAsync(int id, SaveVendorRequest request, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        var vendor = await db.Vendors.SingleOrDefaultAsync(v => v.Id == id, ct) ?? throw NotFoundException.For<Vendor>(id);
        ConcurrencyToken.Apply(db, vendor, request.RowVersion);
        await EnsureTaxIdUniqueAsync(request.TaxId, id, ct);
        vendor.Update(request.Name.Trim(), request.TaxId, request.Email.Trim(), request.Category, request.PaymentTermsDays);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<VendorDto> SetActiveAsync(int id, bool active, CancellationToken ct)
    {
        var vendor = await db.Vendors.SingleOrDefaultAsync(v => v.Id == id, ct) ?? throw NotFoundException.For<Vendor>(id);
        if (active)
        {
            vendor.Activate();
        }
        else
        {
            var hasOpenWork = await db.Invoices.AnyAsync(
                i => i.VendorId == id && (i.Status == InvoiceStatus.Submitted || i.Status == InvoiceStatus.Approved || i.Status == InvoiceStatus.Scheduled),
                ct);
            if (hasOpenWork)
            {
                throw new DomainException("vendor_has_open_invoices", "Settle or reject this vendor's open invoices before deactivating it.");
            }

            vendor.Deactivate();
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private async Task EnsureTaxIdUniqueAsync(string taxId, int? exceptId, CancellationToken ct)
    {
        if (await db.Vendors.AnyAsync(v => v.TaxId == taxId && v.Id != exceptId, ct))
        {
            throw new DomainException("duplicate_vendor", $"A vendor with tax ID {taxId} already exists.");
        }
    }

    private static IQueryable<VendorDto> Project(IQueryable<Vendor> vendors) =>
        vendors.Select(v => new VendorDto(
            v.Id,
            v.Name,
            v.TaxId,
            v.Email,
            v.Category,
            v.PaymentTermsDays,
            v.IsActive,
            v.Invoices
                .Where(i => i.Status == InvoiceStatus.Submitted || i.Status == InvoiceStatus.Approved || i.Status == InvoiceStatus.Scheduled)
                .Sum(i => (decimal?)(i.Total - i.AmountPaid)) ?? 0m,
            v.Invoices.Count(i => i.Status == InvoiceStatus.Submitted || i.Status == InvoiceStatus.Approved || i.Status == InvoiceStatus.Scheduled),
            Convert.ToBase64String(v.RowVersion)));
}
