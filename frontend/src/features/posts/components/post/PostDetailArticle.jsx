import SubPostPanel from "../sub-post/SubPostPanel";
import DetailContent from "./DetailContent";
import DetailHeader from "./DetailHeader";
import DetailInteract from "./DetailInteract";
import RichGallery from "./RichGallery";

export function PostDetailMediaSection({ selectedPost, galleryProps }) {
  if (!shouldShowPostDetailMediaSection({ selectedPost, galleryProps })) {
    return null;
  }
  return <RichGallery {...galleryProps} />;
}

export function shouldShowPostDetailMediaSection({ selectedPost, galleryProps }) {
  const hasRichMedia = galleryProps.richDetailImages.length > 0
    || galleryProps.richImageSources.length > 0;
  return selectedPost.postMode === "rich" && hasRichMedia;
}

export function PostDetailContentSection({ contentProps }) {
  return <DetailContent {...contentProps} />;
}

export function PostDetailInteractionSection({ selectedPost, interactionProps }) {
  return <DetailInteract selectedPost={selectedPost} {...interactionProps} />;
}

export function PostDetailThreadSection({ subPostPanelProps }) {
  return <SubPostPanel {...subPostPanelProps} />;
}

export default function PostDetailArticle({
  loadingPostDetail,
  selectedPost,
  headerProps,
  galleryProps,
  contentProps,
  interactionProps,
  subPostPanelProps,
}) {
  return (
    <article className={`post-detail-paper ${loadingPostDetail ? "is-refreshing" : ""}`}>
      <DetailHeader selectedPost={selectedPost} {...headerProps} />
      <PostDetailMediaSection selectedPost={selectedPost} galleryProps={galleryProps} />
      <PostDetailContentSection contentProps={contentProps} />
      <PostDetailInteractionSection
        selectedPost={selectedPost}
        interactionProps={interactionProps}
      />
      <PostDetailThreadSection subPostPanelProps={subPostPanelProps} />
    </article>
  );
}
