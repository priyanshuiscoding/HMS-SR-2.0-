export function parsePagination(query = {}, { defaultPageSize = 25, maxPageSize = 100 } = {}) {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedPageSize = Number.parseInt(query.pageSize ?? query.limit, 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = Math.min(Number.isFinite(requestedPageSize) && requestedPageSize > 0 ? requestedPageSize : defaultPageSize, maxPageSize);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginationMeta(total, page, pageSize) {
  const safeTotal = Number(total) || 0;
  return { page, pageSize, total: safeTotal, totalPages: Math.max(1, Math.ceil(safeTotal / pageSize)) };
}
