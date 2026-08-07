import UiIcon from "../../../../shared/components/UiIcon";
import CommunityList from "./CommunityList";

export default function CommunityNav({ shellProps, listProps, actionProps }) {
  const { communityNavRef, communityNavHeadRef, isCommunityCondensed } = shellProps;
  const { toggleCommunityCondensed } = actionProps;

  return (
    <section className="left-rail-card sticky-panel" ref={communityNavRef}>
      <div className="community-nav-head" ref={communityNavHeadRef}>
        <div className="community-nav-title">
          <h3>社区导航</h3>
        </div>
        <button
          type="button"
          className="community-toggle-btn"
          onClick={toggleCommunityCondensed}
        >
          <span className="community-toggle-icon" aria-hidden="true">
            <UiIcon name={isCommunityCondensed ? "grid" : "target"} />
          </span>
          <span className="community-toggle-label">
            {isCommunityCondensed ? "全部" : "当前"}
          </span>
        </button>
      </div>
      <CommunityList
        isCommunityCondensed={isCommunityCondensed}
        toggleCommunityCondensed={toggleCommunityCondensed}
        {...listProps}
        {...actionProps}
      />
    </section>
  );
}
