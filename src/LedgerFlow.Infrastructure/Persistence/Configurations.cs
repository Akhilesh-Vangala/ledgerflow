using LedgerFlow.Application.Reporting;
using LedgerFlow.Domain.Invoices;
using LedgerFlow.Domain.Operations;
using LedgerFlow.Domain.Payments;
using LedgerFlow.Domain.Vendors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LedgerFlow.Infrastructure.Persistence;

internal sealed class VendorConfiguration : IEntityTypeConfiguration<Vendor>
{
    public void Configure(EntityTypeBuilder<Vendor> b)
    {
        b.Property(v => v.Name).HasMaxLength(200).IsRequired();
        b.Property(v => v.TaxId).HasMaxLength(20).IsRequired();
        b.Property(v => v.Email).HasMaxLength(256).IsRequired();
        b.Property(v => v.Category).HasMaxLength(50).IsRequired();
        b.Property(v => v.CreatedBy).HasMaxLength(256);
        b.Property(v => v.UpdatedBy).HasMaxLength(256);
        b.Property(v => v.RowVersion).IsRowVersion();
        b.HasIndex(v => v.TaxId).IsUnique();
        b.HasIndex(v => v.Name);
        b.HasMany(v => v.Invoices).WithOne(i => i.Vendor).HasForeignKey(i => i.VendorId).OnDelete(DeleteBehavior.Restrict);
        b.Navigation(v => v.Invoices).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> b)
    {
        b.Property(i => i.InvoiceNumber).HasMaxLength(50).IsRequired();
        b.Property(i => i.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        b.Property(i => i.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(i => i.Notes).HasMaxLength(1000);
        b.Property(i => i.CreatedBy).HasMaxLength(256);
        b.Property(i => i.UpdatedBy).HasMaxLength(256);
        b.Property(i => i.RowVersion).IsRowVersion();

        // Same vendor + same invoice number is the classic duplicate-payment risk; enforce it in the database too.
        b.HasIndex(i => new { i.VendorId, i.InvoiceNumber }).IsUnique();
        b.HasIndex(i => new { i.Status, i.DueDate });
        b.HasIndex(i => i.IsOverdue).HasFilter("[IsOverdue] = 1");

        b.HasOne<PaymentRun>().WithMany().HasForeignKey(i => i.PaymentRunId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(i => i.Lines).WithOne().HasForeignKey(l => l.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(i => i.Events).WithOne().HasForeignKey(e => e.InvoiceId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(i => i.Lines).UsePropertyAccessMode(PropertyAccessMode.Field);
        b.Navigation(i => i.Events).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class InvoiceLineConfiguration : IEntityTypeConfiguration<InvoiceLine>
{
    public void Configure(EntityTypeBuilder<InvoiceLine> b)
    {
        b.Property(l => l.Description).HasMaxLength(300).IsRequired();
        b.Property(l => l.GlAccount).HasMaxLength(4).IsFixedLength().IsRequired();
    }
}

internal sealed class InvoiceEventConfiguration : IEntityTypeConfiguration<InvoiceEvent>
{
    public void Configure(EntityTypeBuilder<InvoiceEvent> b)
    {
        b.Property(e => e.Type).HasConversion<string>().HasMaxLength(20);
        b.Property(e => e.Actor).HasMaxLength(256).IsRequired();
        b.Property(e => e.Comment).HasMaxLength(1000);
        b.HasIndex(e => new { e.InvoiceId, e.OccurredAt });
    }
}

internal sealed class PaymentRunConfiguration : IEntityTypeConfiguration<PaymentRun>
{
    public void Configure(EntityTypeBuilder<PaymentRun> b)
    {
        b.Property(r => r.Name).HasMaxLength(100).IsRequired();
        b.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
        b.Property(r => r.CreatedBy).HasMaxLength(256);
        b.Property(r => r.UpdatedBy).HasMaxLength(256);
        b.Property(r => r.ReleasedBy).HasMaxLength(256);
        b.HasMany(r => r.Payments).WithOne().HasForeignKey(p => p.PaymentRunId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(r => r.Payments).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> b)
    {
        b.Property(p => p.Reference).HasMaxLength(40);
        b.HasOne(p => p.Invoice).WithMany().HasForeignKey(p => p.InvoiceId).OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(p => new { p.PaymentRunId, p.InvoiceId }).IsUnique();
    }
}

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.Property(n => n.Audience).HasMaxLength(256).IsRequired();
        b.Property(n => n.Title).HasMaxLength(200).IsRequired();
        b.Property(n => n.Body).HasMaxLength(1000).IsRequired();
        b.Property(n => n.Link).HasMaxLength(300);
        b.HasIndex(n => new { n.Audience, n.CreatedAt });
    }
}

internal sealed class AgingSnapshotConfiguration : IEntityTypeConfiguration<AgingSnapshot>
{
    public void Configure(EntityTypeBuilder<AgingSnapshot> b)
    {
        b.Property(s => s.Bucket).HasMaxLength(20).IsRequired();
        b.HasIndex(s => new { s.SnapshotDate, s.Bucket }).IsUnique();
    }
}

internal sealed class ReportArchiveConfiguration : IEntityTypeConfiguration<ReportArchive>
{
    public void Configure(EntityTypeBuilder<ReportArchive> b)
    {
        b.Property(r => r.ReportName).HasMaxLength(100).IsRequired();
        b.Property(r => r.FileName).HasMaxLength(200).IsRequired();
        b.Property(r => r.ContentType).HasMaxLength(100).IsRequired();
        b.Property(r => r.GeneratedBy).HasMaxLength(256).IsRequired();
        b.HasIndex(r => r.GeneratedAt);
    }
}

internal sealed class ApAgingRowConfiguration : IEntityTypeConfiguration<ApAgingRow>
{
    public void Configure(EntityTypeBuilder<ApAgingRow> b) => b.HasNoKey().ToView("vw_ApAging");
}

internal sealed class VendorSpendRowConfiguration : IEntityTypeConfiguration<VendorSpendRow>
{
    public void Configure(EntityTypeBuilder<VendorSpendRow> b) => b.HasNoKey().ToView("vw_VendorSpend");
}

internal sealed class PaymentRemittanceRowConfiguration : IEntityTypeConfiguration<PaymentRemittanceRow>
{
    public void Configure(EntityTypeBuilder<PaymentRemittanceRow> b) => b.HasNoKey().ToView("vw_PaymentRemittance");
}
