import { useEffect, useMemo, useRef } from "react";
import { getMediaAsset as getContentMediaAsset } from "../../content/api/contentApi";
import {
  collectPendingSubPostMediaAssetIds,
  isSubPostMediaAssetRefreshPending,
  mergeRefreshedMediaAssetsIntoSubPostList,
} from "../state/subPostMediaRefreshHelpers";

const SUB_POST_MEDIA_REFRESH_DELAY_MS = 3500;
const SUB_POST_MEDIA_REFRESH_MAX_ATTEMPTS = 12;

export function useSubPostMediaRefresh({
  client,
  apiBase = "",
  subPosts = [],
  setSubPosts,
}) {
  const refreshAttemptsRef = useRef(new Map());
  const pendingAssetIds = useMemo(
    () => collectPendingSubPostMediaAssetIds(subPosts),
    [subPosts],
  );

  useEffect(() => {
    const activeAssetIds = new Set(pendingAssetIds);
    for (const assetId of refreshAttemptsRef.current.keys()) {
      if (!activeAssetIds.has(assetId)) {
        refreshAttemptsRef.current.delete(assetId);
      }
    }
  }, [pendingAssetIds]);

  useEffect(() => {
    if (!client || pendingAssetIds.length === 0 || typeof setSubPosts !== "function") {
      return undefined;
    }
    const assetIds = pendingAssetIds.filter((assetId) => {
      const attempts = Number(refreshAttemptsRef.current.get(assetId) || 0);
      return attempts < SUB_POST_MEDIA_REFRESH_MAX_ATTEMPTS;
    });
    if (assetIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      assetIds.forEach((assetId) => {
        const attempts = Number(refreshAttemptsRef.current.get(assetId) || 0);
        refreshAttemptsRef.current.set(assetId, attempts + 1);
      });
      const refreshedResults = await Promise.allSettled(
        assetIds.map((assetId) => getContentMediaAsset(client, { assetId })),
      );
      if (cancelled) {
        return;
      }
      const refreshedAssets = refreshedResults
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value)
        .filter((asset) => Number(asset?.id || 0) > 0);
      if (refreshedAssets.length === 0) {
        return;
      }

      refreshedAssets
        .filter((asset) => !isSubPostMediaAssetRefreshPending(asset))
        .forEach((asset) => refreshAttemptsRef.current.delete(Number(asset.id || 0)));

      setSubPosts((prev) =>
        mergeRefreshedMediaAssetsIntoSubPostList(prev, refreshedAssets, apiBase),
      );
    }, SUB_POST_MEDIA_REFRESH_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    apiBase,
    client,
    pendingAssetIds,
    setSubPosts,
  ]);
}
