import UiIcon from "../../../../shared/components/UiIcon";

export default function SortMenuControl({
  route,
  view,
  feedSortMode,
  sortMenuAnchor,
  feedSortModes,
  topSortRef,
  toggleSortMenu,
  applyFeedSort,
  handleTopbarLeadingAction,
  feedSortLabel,
}) {
  return (
    <div
      ref={route.type === "home" && view !== "mine" ? topSortRef : null}
      className="search-sort-control"
    >
      {route.type === "home" && view !== "mine" ? (
        <>
          <button
            type="button"
            className={`search-sort-trigger ${sortMenuAnchor === "top" ? "open" : ""}`}
            title={`当前排序：${feedSortLabel(feedSortMode)}`}
            onClick={() => toggleSortMenu("top")}
            aria-haspopup="listbox"
            aria-expanded={sortMenuAnchor === "top"}
            aria-label="排序"
          >
            <UiIcon name="sort" />
          </button>
          <div
            className={`search-sort-menu ${sortMenuAnchor === "top" ? "open" : ""}`}
            role="listbox"
            aria-label="信息流排序"
          >
            {feedSortModes.map((mode) => (
              <button
                key={`top-${mode}`}
                type="button"
                className={`search-sort-option ${feedSortMode === mode ? "active" : ""}`}
                onClick={() => applyFeedSort(mode)}
              >
                <span>{feedSortLabel(mode)}</span>
                {feedSortMode === mode && <UiIcon name="check" />}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          type="button"
          className="search-sort-trigger"
          title="返回上一级"
          onClick={handleTopbarLeadingAction}
          aria-label="返回上一级"
        >
          <UiIcon name="arrow-left" />
        </button>
      )}
    </div>
  );
}
