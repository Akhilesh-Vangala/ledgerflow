using Microsoft.EntityFrameworkCore;

namespace LedgerFlow.Application.Common;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount)
{
    public int TotalPages => PageSize == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public static class PagingExtensions
{
    public const int MaxPageSize = 100;

    public static async Task<PagedResult<T>> ToPagedAsync<T>(this IQueryable<T> query, int page, int pageSize, CancellationToken cancellationToken)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var total = await query.CountAsync(cancellationToken);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return new PagedResult<T>(items, page, pageSize, total);
    }
}
