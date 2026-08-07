import { useCallback, useEffect, useMemo, useState } from "react";
import { listCommunities as listContentCommunities } from "../../content/api/contentApi";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";
import { sortCommunitiesByOrder } from "../../../shared/state/appHelpers";

export function useCommunitiesCatalog({
  client,
  publishCommunityOrder,
  lobbyCommunity,
  feedQueryRuntime,
  setMessage,
}) {
  const [communities, setCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const selectedCommunitySlug = feedQueryRuntime?.selectedCommunitySlug;
  const setSelectedCommunitySlug = feedQueryRuntime?.setSelectedCommunitySlug;

  const loadCommunities = useCallback(async () => {
    setLoadingCommunities(true);
    try {
      const communityList = (await listContentCommunities(client)).filter((community) =>
        publishCommunityOrder.includes(community.slug),
      );
      setCommunities(communityList);
      if (
        selectedCommunitySlug !== "lobby" &&
        !communityList.some((community) => community.slug === selectedCommunitySlug)
      ) {
        setSelectedCommunitySlug("lobby");
      }
    } catch (error) {
      setMessage(readableError(error, UI_MESSAGES.communitiesLoadFailed));
    } finally {
      setLoadingCommunities(false);
    }
  }, [
    client,
    publishCommunityOrder,
    selectedCommunitySlug,
    setMessage,
    setSelectedCommunitySlug,
  ]);

  useEffect(() => {
    loadCommunities();
  }, [loadCommunities]);

  const orderedCommunities = useMemo(
    () => sortCommunitiesByOrder(communities, publishCommunityOrder),
    [communities, publishCommunityOrder],
  );

  const navigationCommunities = useMemo(
    () => [lobbyCommunity, ...orderedCommunities].filter(Boolean),
    [lobbyCommunity, orderedCommunities],
  );

  return {
    communities,
    orderedCommunities,
    navigationCommunities,
    loadingCommunities,
    loadCommunities,
  };
}
