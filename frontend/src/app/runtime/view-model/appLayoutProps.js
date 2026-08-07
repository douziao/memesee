import { buildAppChromeProps } from "./appLayoutChromePropsBuilders";
import { buildAppOverlayProps } from "./appLayoutOverlayPropsBuilders";
import { buildDocumentMetadata } from "../appDocumentMetadata";

function resolveSelectedCommunity(selectedSlug, source) {
  if (!selectedSlug) {
    return null;
  }
  return [
    ...(Array.isArray(source?.navigationCommunities) ? source.navigationCommunities : []),
    ...(Array.isArray(source?.orderedCommunities) ? source.orderedCommunities : []),
  ].find((community) => community?.slug === selectedSlug) || {
    slug: selectedSlug,
    name: selectedSlug,
  };
}

function resolveMetadataSelectedCommunity({ metadataContext, queryRuntimes, communityCatalogState }) {
  return resolveSelectedCommunity(
    metadataContext
      ? metadataContext.selectedCommunitySlug || ""
      : queryRuntimes?.feedQueryRuntime?.selectedCommunitySlug || "",
    metadataContext || communityCatalogState,
  );
}

export function buildAppLayoutProps(dependencies) {
  const metadataContext = dependencies.metadataContext || {};
  return {
    chromeProps: buildAppChromeProps(dependencies),
    overlayProps: buildAppOverlayProps(dependencies),
    metadataProps: buildDocumentMetadata({
      route: metadataContext.route || dependencies.appChrome?.route || dependencies.shell?.route,
      view: metadataContext.view || dependencies.view || dependencies.shell?.view,
      selectedPost:
        metadataContext.selectedPost
        || dependencies.postDetailView?.selectedPost
        || dependencies.detail?.selectedPost,
      subPosts:
        metadataContext.subPosts
        || dependencies.postDetailView?.subPosts
        || dependencies.detail?.subPosts,
      targetSubPostStatus:
        metadataContext.targetSubPostStatus
        || dependencies.subPostThread?.targetSubPostStatus,
      selectedCommunity: resolveMetadataSelectedCommunity({
        metadataContext: dependencies.metadataContext,
        queryRuntimes: dependencies.queryRuntimes,
        communityCatalogState: dependencies.communityCatalogState,
      }),
      origin: typeof window === "undefined" ? "" : window.location.origin,
    }),
  };
}
