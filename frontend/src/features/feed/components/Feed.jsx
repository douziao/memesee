import { Suspense, lazy } from "react";
import HomeFeed from "./HomeFeed";
import { StatusCard } from "../../../shared/components/PageShell";

const ComposerPage = lazy(() => import("../../composer/components/ComposerPage"));
const PostDetailView = lazy(() => import("../../posts/components/post/PostDetailView"));
const ProfileCenter = lazy(() => import("../../profile/components/ProfileCenter"));

function FeedRouteFallback({ kicker, title, description }) {
  return (
    <section className="feed-grid">
      <StatusCard
        kicker={kicker}
        title={title}
        description={description}
        tone="loading"
        role="status"
        ariaLive="polite"
      >
        <span className="feed-status-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </StatusCard>
    </section>
  );
}

export default function Feed({
  route,
  view,
  homeFeedProps,
  profileCenterProps,
  postDetailProps,
  composerPageProps,
}) {
  return (
    <main className="feed">
      {route.type === "home" && view !== "mine" && (
        <HomeFeed {...homeFeedProps} />
      )}
      {route.type === "home" && view === "mine" && (
        <Suspense
          fallback={(
            <FeedRouteFallback
              kicker="个人中心"
              title="正在打开个人中心"
              description="你的主页、通知和收藏马上就好。"
            />
          )}
        >
          <ProfileCenter {...profileCenterProps} />
        </Suspense>
      )}
      {route.type === "post" && (
        <Suspense
          fallback={(
            <FeedRouteFallback
              kicker="主帖详情"
              title="主帖马上出现"
              description="正文会先显示，子帖随后补上。"
            />
          )}
        >
          <PostDetailView {...postDetailProps} />
        </Suspense>
      )}
      {route.type === "compose" && (
        <Suspense
          fallback={(
            <FeedRouteFallback
              kicker="发布主帖"
              title="正在打开编辑器"
              description="编辑器和图片工具马上就好。"
            />
          )}
        >
          <ComposerPage {...composerPageProps} />
        </Suspense>
      )}
    </main>
  );
}
