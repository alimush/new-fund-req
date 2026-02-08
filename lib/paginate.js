export function paginate(list, page, pageSize) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    const items = list.slice(start, start + pageSize);
    return { items, total, totalPages, page: safePage };
  }