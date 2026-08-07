import ProfileCommunityPosts from "./ProfileCommunityPosts";
import ProfileLibraryPage from "./ProfileLibraryPage";
import ProfileNotificationPage from "./ProfileNotificationPage";
import ProfileOverview from "./ProfileOverview";
import { StatusCard } from "../../../shared/components/PageShell";
import "./Profile.css";

export function buildProfileCenterStatus({
  loadingProfile,
  isLoggedIn,
  profile,
  profileError,
}) {
  if (loadingProfile) {
    return {
      type: "loading",
      kicker: "个人中心",
      title: "正在打开个人中心",
      description: "你的主页、通知和收藏马上就好。",
    };
  }
  if (!isLoggedIn) {
    return {
      type: "logged-out",
      title: "请先登录后查看个人中心",
      description: "登录后可以查看通知、收藏、点赞和发布记录。",
    };
  }
  if (profile) {
    return { type: "ready" };
  }
  if (profileError) {
    return {
      type: "error",
      title: "个人中心加载失败",
      description: profileError,
      actionLabel: "重试打开个人中心",
    };
  }
  return {
    type: "empty",
    title: "个人资料暂时不可用",
    description: "可以稍后再试一次。",
  };
}

export default function ProfileCenter({
  statusProps,
  overviewProps,
  communityPostsProps,
  libraryPageProps,
  notificationPageProps,
}) {
  const {
    loadingProfile,
    isLoggedIn,
    profile,
    profileError,
    retryProfile,
  } = statusProps;
  const statusState = buildProfileCenterStatus({
    loadingProfile,
    isLoggedIn,
    profile,
    profileError,
  });

  return (
    <section className="feed-grid">
      {statusState.type === "loading" && (
        <StatusCard
          kicker={statusState.kicker}
          title={statusState.title}
          description={statusState.description}
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
      )}
      {statusState.type === "logged-out" && (
        <StatusCard
          title={statusState.title}
          description={statusState.description}
          tone="empty"
        />
      )}
      {statusState.type === "ready" && (
        <article className="profile-center-card profile-paper">
          {!libraryPageProps.activeProfileLibraryPage &&
            !notificationPageProps.activeProfileNotificationPage &&
            !communityPostsProps.activeProfileCommunity && (
            <ProfileOverview {...overviewProps} />
          )}
          {libraryPageProps.activeProfileLibraryPage && (
            <ProfileLibraryPage {...libraryPageProps} />
          )}
          {!libraryPageProps.activeProfileLibraryPage &&
            notificationPageProps.activeProfileNotificationPage && (
            <ProfileNotificationPage {...notificationPageProps} />
          )}
          {!libraryPageProps.activeProfileLibraryPage &&
            !notificationPageProps.activeProfileNotificationPage &&
            communityPostsProps.activeProfileCommunity && (
            <ProfileCommunityPosts {...communityPostsProps} />
          )}
        </article>
      )}
      {statusState.type === "error" && (
        <StatusCard
          title={statusState.title}
          description={statusState.description}
          role="alert"
          ariaLive="assertive"
        >
          <button
            type="button"
            className="neo-btn small"
            onClick={() => retryProfile?.()}
          >
            {statusState.actionLabel}
          </button>
        </StatusCard>
      )}
      {statusState.type === "empty" && (
        <StatusCard
          title={statusState.title}
          description={statusState.description}
          tone="empty"
        />
      )}
    </section>
  );
}
