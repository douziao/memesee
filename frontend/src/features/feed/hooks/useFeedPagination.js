import { useCallback, useEffect, useRef, useState } from "react";
import { listFeedPosts as listContentFeedPosts } from "../../content/api/contentApi";
import { mergeFeedSnapshotWithKnownState, mergePostPages } from "../../posts/state/mainPostStateHelpers";
import {
  normalizeFeedPage,
  resolveFeedContinuation,
  shouldSkipFeedAppend,
} from "../state/feedViewHelpers";
import { UI_MESSAGES, readableError } from "../../../shared/state/uiMessages";

export function useFeedPagination({
  client,
  token,
  apiBase,
  setMessage,
  feedBatchSize,
}) {
  const [selectedCommunitySlug, setSelectedCommunitySlug] = useState("lobby");
  const [posts, setPosts] = useState([]);
  const [feedCursor, setFeedCursor] = useState("");
  const [feedHasMore, setFeedHasMore] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [loadingMorePostsError, setLoadingMorePostsError] = useState("");
  const feedLoadMoreRef = useRef(null);
  const feedRequestSeqRef = useRef(0);
  const selectedCommunitySlugRef = useRef(selectedCommunitySlug);
  const feedCursorRef = useRef(feedCursor);
  const feedHasMoreRef = useRef(feedHasMore);
  const loadingPostsRef = useRef(loadingPosts);
  const loadingMorePostsRef = useRef(loadingMorePosts);

  useEffect(() => {
    selectedCommunitySlugRef.current = selectedCommunitySlug;
  }, [selectedCommunitySlug]);

  useEffect(() => {
    feedCursorRef.current = feedCursor;
  }, [feedCursor]);

  useEffect(() => {
    feedHasMoreRef.current = feedHasMore;
  }, [feedHasMore]);

  useEffect(() => {
    loadingPostsRef.current = loadingPosts;
  }, [loadingPosts]);

  useEffect(() => {
    loadingMorePostsRef.current = loadingMorePosts;
  }, [loadingMorePosts]);

  const resetFeedCollection = useCallback(() => {
    setPosts([]);
    setFeedCursor("");
    setFeedHasMore(true);
    setFeedError("");
    setLoadingMorePostsError("");
    feedCursorRef.current = "";
    feedHasMoreRef.current = true;
  }, []);

  const loadPosts = useCallback(async (
    communitySlug,
    keyword = "",
    sortMode = "latest_message",
    options = {},
  ) => {
    const append = Boolean(options.append);
    const reset = Boolean(options.reset);
    const resolvedCommunitySlug = String(
      communitySlug || selectedCommunitySlugRef.current || "lobby",
    );

    if (
      shouldSkipFeedAppend({
        append,
        loadingPosts: loadingPostsRef.current,
        loadingMorePosts: loadingMorePostsRef.current,
        feedHasMore: feedHasMoreRef.current,
        feedCursor: feedCursorRef.current,
      })
    ) {
      return;
    }

    if (append) {
      setLoadingMorePostsError("");
      loadingMorePostsRef.current = true;
      setLoadingMorePosts(true);
    } else {
      loadingPostsRef.current = true;
      setLoadingPosts(true);
      setLoadingMorePostsError("");
      if (reset) {
        feedCursorRef.current = "";
        feedHasMoreRef.current = true;
        setFeedCursor("");
        setFeedHasMore(true);
      }
    }

    const requestId = ++feedRequestSeqRef.current;
    const requestCursor = append ? feedCursorRef.current : "";
    try {
      if (!append) {
        setFeedError("");
      }
      const payload = await listContentFeedPosts(client, {
        token,
        communitySlug: resolvedCommunitySlug,
        keyword,
        sortMode,
        cursor: requestCursor,
        size: feedBatchSize,
      });

      if (requestId !== feedRequestSeqRef.current) {
        return;
      }

      const normalizedPage = normalizeFeedPage(payload, apiBase);
      const continuation = resolveFeedContinuation({
        append,
        previousCursor: requestCursor,
        nextCursor: normalizedPage.nextCursor,
        hasMore: normalizedPage.hasMore,
      });
      feedCursorRef.current = continuation.nextCursor;
      feedHasMoreRef.current = continuation.hasMore;
      setFeedCursor(continuation.nextCursor);
      setFeedHasMore(continuation.hasMore);
      setPosts((prev) =>
        append
          ? mergePostPages(prev, normalizedPage.posts)
          : mergeFeedSnapshotWithKnownState(prev, normalizedPage.posts),
      );
    } catch (error) {
      if (requestId === feedRequestSeqRef.current) {
        const message = readableError(error, UI_MESSAGES.feedLoadFailed);
        if (append) {
          setLoadingMorePostsError(message);
        } else {
          setFeedError(message);
        }
        setMessage(message);
      }
    } finally {
      if (requestId === feedRequestSeqRef.current) {
        if (append) {
          loadingMorePostsRef.current = false;
          setLoadingMorePosts(false);
        } else {
          loadingPostsRef.current = false;
          setLoadingPosts(false);
        }
      }
    }
  }, [
    apiBase,
    client,
    feedBatchSize,
    setMessage,
    token,
  ]);

  return {
    selectedCommunitySlug,
    setSelectedCommunitySlug,
    posts,
    setPosts,
    feedCursor,
    feedHasMore,
    feedError,
    loadingMorePostsError,
    loadingPosts,
    loadingMorePosts,
    feedLoadMoreRef,
    resetFeedCollection,
    loadPosts,
  };
}
