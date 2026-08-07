import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadMyInteractions,
  loadMyPosts,
  loadMyProfile,
  loadMySubPosts,
} from "../state/profileViewDataApi";
import {
  applyProfileInteractionChanges,
  buildProfileCommunitySummaries,
  buildProfileDashboard,
  buildProfilePostsByCommunity,
  emptyProfileInteractions,
  removeProfileInteractionsForDeletedPost,
  removeProfileInteractionsForDeletedSubPost,
  removeProfilePostListItem,
  removeProfileSubPostListItem,
  removeProfileSubPostsForMainPost,
  resolveActiveProfileCommunity,
  syncExistingProfilePostListItem,
  syncExistingProfileSubPostListItem,
  syncProfileInteractionsForSavedPost,
  updateProfileInteractionsForPostAction,
  updateProfileInteractionsForSubPostAction,
  upsertProfilePostList,
} from "../state/profileViewHelpers";
import { normalizeProfilePositiveId } from "../state/profileIdHelpers";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";

export function useProfileView({
  view,
  isLoggedIn,
  token,
  orderedCommunities,
  levelProgress,
  userLevel,
  client,
  apiBase,
  setMessage,
  syncUserProgressFromPayload,
  profilePostPageSize,
}) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profilePosts, setProfilePosts] = useState([]);
  const [profileSubPosts, setProfileSubPosts] = useState([]);
  const [profileInteractions, setProfileInteractions] = useState(
    emptyProfileInteractions(),
  );
  const [profileLevelExpanded, setProfileLevelExpanded] = useState(false);
  const [activeProfileCommunitySlug, setActiveProfileCommunitySlug] = useState("");
  const [activeProfileLibraryPage, setActiveProfileLibraryPage] = useState("");
  const [activeProfileNotificationPage, setActiveProfileNotificationPage] = useState(false);
  const [profileReloadVersion, setProfileReloadVersion] = useState(0);
  const syncUserProgressRef = useRef(syncUserProgressFromPayload);
  const pendingProfileInteractionChangesRef = useRef([]);

  useEffect(() => {
    syncUserProgressRef.current = syncUserProgressFromPayload;
  }, [syncUserProgressFromPayload]);

  const {
    dashboardPercent,
    dashboardCurrentLevel,
    dashboardNextLevel,
    dashboardCriteria,
    pendingDashboardCriteria,
  } = useMemo(
    () => buildProfileDashboard(levelProgress, userLevel),
    [levelProgress, userLevel],
  );
  const profilePostsByCommunity = useMemo(() => {
    return buildProfilePostsByCommunity(orderedCommunities, profilePosts);
  }, [orderedCommunities, profilePosts]);
  const profileCommunitySummaries = useMemo(
    () => buildProfileCommunitySummaries(profilePostsByCommunity),
    [profilePostsByCommunity],
  );
  const activeProfileCommunity = useMemo(
    () => resolveActiveProfileCommunity(
      profilePostsByCommunity,
      activeProfileCommunitySlug,
      orderedCommunities,
    ),
    [activeProfileCommunitySlug, orderedCommunities, profilePostsByCommunity],
  );

  useEffect(() => {
    if (activeProfileLibraryPage) {
      setActiveProfileCommunitySlug("");
      setActiveProfileNotificationPage(false);
    }
  }, [activeProfileLibraryPage]);

  const refreshProfilePosts = useCallback(async (authToken = token) => {
    const nextPosts = await loadMyPosts({
      client,
      token: authToken,
      limit: profilePostPageSize,
      apiBase,
    });
    setProfilePosts(nextPosts);
    return nextPosts;
  }, [apiBase, client, profilePostPageSize, token]);

  const refreshProfileSubPosts = useCallback(async (authToken = token) => {
    const nextSubPosts = await loadMySubPosts({
      client,
      token: authToken,
      limit: profilePostPageSize,
    });
    setProfileSubPosts(nextSubPosts);
    return nextSubPosts;
  }, [client, profilePostPageSize, token]);

  const removeProfilePost = useCallback((mainPostId) => {
    const normalizedMainPostId = normalizeProfilePositiveId(mainPostId);
    if (!normalizedMainPostId) {
      return;
    }
    setProfilePosts((prev) => removeProfilePostListItem(prev, normalizedMainPostId));
    setProfileSubPosts((prev) => removeProfileSubPostsForMainPost(prev, normalizedMainPostId));
    setProfileInteractions((prev) =>
      removeProfileInteractionsForDeletedPost(prev, normalizedMainPostId),
    );
  }, []);

  const upsertProfilePost = useCallback((savedPost) => {
    setProfilePosts((prev) => upsertProfilePostList(prev, savedPost));
    setProfileInteractions((prev) => syncProfileInteractionsForSavedPost(prev, savedPost));
  }, []);

  const syncProfilePostSnapshot = useCallback((postSnapshot) => {
    setProfilePosts((prev) => syncExistingProfilePostListItem(prev, postSnapshot));
    setProfileInteractions((prev) => syncProfileInteractionsForSavedPost(prev, postSnapshot));
  }, []);

  const syncProfilePostInteraction = useCallback((interactionChange) => {
    pendingProfileInteractionChangesRef.current = [
      ...pendingProfileInteractionChangesRef.current,
      { target: "post", change: interactionChange },
    ].slice(-50);
    setProfileInteractions((prev) =>
      updateProfileInteractionsForPostAction(prev, interactionChange),
    );
  }, []);

  const syncProfileSubPostInteraction = useCallback((interactionChange) => {
    pendingProfileInteractionChangesRef.current = [
      ...pendingProfileInteractionChangesRef.current,
      { target: "sub-post", change: interactionChange },
    ].slice(-50);
    setProfileSubPosts((prev) =>
      syncExistingProfileSubPostListItem(prev, interactionChange?.subPost),
    );
    setProfileInteractions((prev) =>
      updateProfileInteractionsForSubPostAction(prev, interactionChange),
    );
  }, []);

  const removeProfileSubPost = useCallback((subPostId) => {
    const normalizedSubPostId = normalizeProfilePositiveId(subPostId);
    if (!normalizedSubPostId) {
      return;
    }
    setProfileSubPosts((prev) => removeProfileSubPostListItem(prev, normalizedSubPostId));
    setProfileInteractions((prev) =>
      removeProfileInteractionsForDeletedSubPost(prev, normalizedSubPostId),
    );
  }, []);

  function clearProfileState() {
    setProfile(null);
    setLoadingProfile(false);
    setProfileError("");
    setProfilePosts([]);
    setProfileSubPosts([]);
    setProfileInteractions(emptyProfileInteractions());
    setProfileLevelExpanded(false);
    setActiveProfileCommunitySlug("");
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
  }

  const retryProfile = useCallback(() => {
    setProfileReloadVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (view !== "mine") {
      setActiveProfileCommunitySlug("");
      setActiveProfileLibraryPage("");
      setActiveProfileNotificationPage(false);
      setProfileLevelExpanded(false);
      setProfileError("");
      return;
    }
    if (!isLoggedIn) {
      clearProfileState();
      return;
    }
    let active = true;
    setLoadingProfile(true);
    setProfileError("");
    Promise.all([
      loadMyProfile(client, token),
      loadMyPosts({
        client,
        token,
        limit: profilePostPageSize,
        apiBase,
      }),
      loadMyInteractions({ client, token, limit: 1000 }),
      loadMySubPosts({ client, token, limit: 1000 }),
    ])
      .then(([profileData, myPostList, interactionData, mySubPostList]) => {
        if (!active) {
          return;
        }
        setProfile(profileData);
        setProfileError("");
        syncUserProgressRef.current(profileData);
        setProfilePosts(myPostList);
        setProfileInteractions(applyProfileInteractionChanges(
          interactionData,
          pendingProfileInteractionChangesRef.current,
        ));
        setProfileSubPosts(mySubPostList);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        const message = readableError(error, UI_MESSAGES.profileLoadFailed);
        setProfileError(message);
        setMessage(message);
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
        }
      });
    return () => {
      active = false;
    };
  }, [
    apiBase,
    client,
    isLoggedIn,
    profilePostPageSize,
    profileReloadVersion,
    setMessage,
    token,
    view,
  ]);

  useEffect(() => {
    if (!activeProfileCommunitySlug) {
      return;
    }
    setActiveProfileLibraryPage("");
    setActiveProfileNotificationPage(false);
  }, [activeProfileCommunitySlug]);

  return {
    profile,
    loadingProfile,
    profileError,
    profilePosts,
    profileSubPosts,
    profileInteractions,
    profileLevelExpanded,
    activeProfileCommunitySlug,
    activeProfileLibraryPage,
    activeProfileNotificationPage,
    dashboardPercent,
    dashboardCurrentLevel,
    dashboardNextLevel,
    dashboardCriteria,
    pendingDashboardCriteria,
    profileCommunitySummaries,
    activeProfileCommunity,
    setProfileLevelExpanded,
    setActiveProfileCommunitySlug,
    setActiveProfileLibraryPage,
    setActiveProfileNotificationPage,
    refreshProfilePosts,
    refreshProfileSubPosts,
    retryProfile,
    upsertProfilePost,
    syncProfilePostSnapshot,
    syncProfilePostInteraction,
    syncProfileSubPostInteraction,
    removeProfilePost,
    removeProfileSubPost,
    clearProfileState,
  };
}
