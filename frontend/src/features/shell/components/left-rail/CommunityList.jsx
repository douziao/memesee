import CommunityItem from "./CommunityItem";

export default function CommunityList({
  loadingCommunities,
  navigationCommunities,
  selectedCommunitySlug,
  isCommunityCondensed,
  communityMarks,
  communityShortDescriptions,
  selectCommunity,
}) {
  const hasCommunities = Array.isArray(navigationCommunities) && navigationCommunities.length > 0;

  return (
    <div
      className={`community-list ${isCommunityCondensed ? "condensed" : ""} ${
        loadingCommunities && hasCommunities ? "is-refreshing" : ""
      }`}
    >
      {loadingCommunities && !hasCommunities && (
        <div className="paper-inline-status community-loading">{"\u52a0\u8f7d\u793e\u533a\u4e2d..."}</div>
      )}
      {hasCommunities &&
        navigationCommunities.map((community, index) => (
          <CommunityItem
            key={community.slug}
            community={community}
            index={index}
            selectedCommunitySlug={selectedCommunitySlug}
            communityMarks={communityMarks}
            communityShortDescriptions={communityShortDescriptions}
            selectCommunity={selectCommunity}
          />
        ))}
    </div>
  );
}
