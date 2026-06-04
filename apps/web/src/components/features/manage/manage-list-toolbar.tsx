type GroupChip = { label: string; count: number };

type Props = {
  groupLabel: string;
  groupValue: string;
  groupOptions: { value: string; label: string }[];
  onGroupChange: (value: string) => void;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filteredCount: number;
  totalCount: number;
  chips: GroupChip[];
};

export function ManageListToolbar({
  groupLabel,
  groupValue,
  groupOptions,
  onGroupChange,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  filteredCount,
  totalCount,
  chips,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs font-bold text-[#6f6559]">
        {groupLabel}
        <select
          className="min-h-9 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
          value={groupValue}
          onChange={(e) => onGroupChange(e.target.value)}
        >
          {groupOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-[200px] flex-1 gap-1 text-xs font-bold text-[#6f6559]">
        查找
        <input
          type="search"
          className="min-h-9 rounded-md border border-[#d7c7aa] bg-[#fffdf7] px-2 text-sm"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </label>
      <span className="pb-1 text-xs text-[#6f6559]">
        显示 {filteredCount} / {totalCount}
      </span>
      <div className="flex w-full flex-wrap gap-2 text-xs">
        {groupValue === "none" ? (
          <span className="rounded-full border border-[#d7c7aa] px-2 py-1 text-[#6f6559]">未分组</span>
        ) : (
          chips.map((g) => (
            <span key={g.label} className="rounded-full bg-[#1f7a69]/10 px-2 py-1 font-bold text-[#15584c]">
              {g.label} {g.count}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
