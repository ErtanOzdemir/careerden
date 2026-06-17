interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
}

export default function Pagination({ current, total, pageSize }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="px-6 py-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low">
      <div className="text-label-sm text-secondary">
        Showing {from} to {to} of {total} results
      </div>
      <div className="flex items-center gap-2">
        <button
          disabled={current === 1}
          className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        {[1, 2, 3].map((page) => (
          <button
            key={page}
            className={`w-10 h-10 rounded-lg text-label-md font-bold transition-colors ${
              page === current ? "bg-primary text-on-primary" : "hover:bg-surface-container-high"
            }`}
          >
            {page}
          </button>
        ))}
        <span className="px-2 text-secondary">...</span>
        <button className="w-10 h-10 hover:bg-surface-container-high rounded-lg text-label-md font-bold transition-colors">
          {totalPages}
        </button>
        <button
          disabled={current === totalPages}
          className="p-2 border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
