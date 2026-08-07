import SearchForm from "./SearchForm";
import SortMenuControl from "./SortMenuControl";

export default function TopbarIsland({
  shellProps,
  sortProps,
  searchProps,
}) {
  const { route, view } = shellProps;
  const {
    feedSortMode,
    sortMenuAnchor,
    feedSortModes,
    topSortRef,
    toggleSortMenu,
    applyFeedSort,
    handleTopbarLeadingAction,
    feedSortLabel,
  } = sortProps;
  const { applySearch } = searchProps;

  return (
    <form
      className="topbar-island"
      onSubmit={(event) => {
        event.preventDefault();
        applySearch();
      }}
    >
      {route.type === "home" || route.type === "post" || route.type === "compose" ? (
        <SortMenuControl
          route={route}
          view={view}
          feedSortMode={feedSortMode}
          sortMenuAnchor={sortMenuAnchor}
          feedSortModes={feedSortModes}
          topSortRef={topSortRef}
          toggleSortMenu={toggleSortMenu}
          applyFeedSort={applyFeedSort}
          handleTopbarLeadingAction={handleTopbarLeadingAction}
          feedSortLabel={feedSortLabel}
        />
      ) : null}
      <SearchForm {...searchProps} />
    </form>
  );
}
