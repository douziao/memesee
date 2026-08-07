import UiIcon from "../../../../shared/components/UiIcon";

export default function SearchForm({
  searchInput,
  setSearchInput,
}) {
  return (
    <>
      <input
        className="topbar-island-input"
        placeholder="搜索标题或正文"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      <button
        type="submit"
        className="search-submit-trigger"
        title="搜索"
        aria-label="搜索"
      >
        <UiIcon name="search" />
      </button>
    </>
  );
}
