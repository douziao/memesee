export default function CommunityItem({
  community,
  index,
  selectedCommunitySlug,
  communityMarks,
  communityShortDescriptions,
  selectCommunity,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`community-item ${selectedCommunitySlug === community.slug ? "active" : ""}`}
      onClick={() => selectCommunity(community.slug)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCommunity(community.slug);
        }
      }}
    >
      <span className="community-icon">
        {communityMarks[community.slug] || String(index + 1)}
      </span>
      <div className="community-info">
        <span className="community-name">{community.name}</span>
        <span className="community-desc">
          {communityShortDescriptions[community.slug] || community.description}
        </span>
      </div>
    </div>
  );
}
