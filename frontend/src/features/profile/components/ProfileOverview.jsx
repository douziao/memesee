import UiIcon from "../../../shared/components/UiIcon";

function validId(value) {
  return value > 0 && value == parseInt(value) ? value : 0;
}

function mainPostKey(item) {
  return String(validId(item?.id) || validId(item?.postId) || "");
}

function mainPostKeyFromSubPost(item) {
  return String(
    validId(item?.mainPostId)
      || validId(item?.postId)
      || validId(item?.mainPost?.id)
      || validId(item?.mainPost?.postId)
      || "",
  );
}

export function countLibraryMainPosts({
  profilePosts = [],
  profileSubPosts = [],
  postInteractions = [],
  subPostInteractions = [],
  action,
}) {
  const keys = new Set();
  if (action) {
    postInteractions
      .filter((item) => item.action === action)
      .forEach((item) => {
        const key = mainPostKey(item);
        if (key) {
          keys.add(key);
        }
      });
    subPostInteractions
      .filter((item) => item.action === action)
      .forEach((item) => {
        const key = mainPostKeyFromSubPost(item);
        if (key) {
          keys.add(key);
        }
      });
    return keys.size;
  }

  profilePosts.forEach((item) => {
    const key = mainPostKey(item);
    if (key) {
      keys.add(key);
    }
  });
  profileSubPosts.forEach((item) => {
    const key = mainPostKeyFromSubPost(item);
    if (key) {
      keys.add(key);
    }
  });
  return keys.size;
}

function LibraryEntry({ title, count, countText, icon, onClick }) {
  return (
    <button type="button" className="profile-library-entry" onClick={onClick}>
      <span className="profile-library-entry-icon" aria-hidden="true">
        <UiIcon name={icon} />
      </span>
      <span className="profile-library-entry-main">
        <strong>{title}</strong>
        <span>{countText || `${count} 条`}</span>
      </span>
      <UiIcon name="chevron-right" />
    </button>
  );
}

export default function ProfileOverview({
  identityProps,
  statsProps,
  levelProps,
  notificationProps,
  interactionProps,
  actionProps,
}) {
  const { profile, formatDateTime } = identityProps;
  const {
    profilePostsCount,
    profileSubPostsCount,
    profilePosts = [],
    profileSubPosts = [],
    openProfileLibraryPage,
  } = statsProps;
  const {
    levelProgress,
    dashboardPercent,
    dashboardCurrentLevel,
    dashboardNextLevel,
    dashboardCriteria = [],
    profileLevelExpanded,
    setProfileLevelExpanded,
  } = levelProps;
  const {
    notificationUnreadCount,
    openProfileNotificationPage,
  } = notificationProps;
  const {
    postInteractions,
    subPostInteractions,
  } = interactionProps;
  const { logout } = actionProps;
  const likedCount = countLibraryMainPosts({
    postInteractions,
    subPostInteractions,
    action: "like",
  });
  const favoriteCount = countLibraryMainPosts({
    postInteractions,
    subPostInteractions,
    action: "favorite",
  });
  const hasProfilePostLists = Array.isArray(profilePosts) || Array.isArray(profileSubPosts);
  const publishedCount = hasProfilePostLists ? countLibraryMainPosts({
    profilePosts,
    profileSubPosts,
  }) : profilePostsCount + profileSubPostsCount;

  return (
    <>
      <div className="profile-overview-header">
        <div className="profile-overview-user">
          <div className="profile-overview-avatar">
            {profile.username.slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-overview-meta">
            <h2>{profile.username}</h2>
            <p>UID: {profile.uid}</p>
            <p>加入时间：{formatDateTime(profile.joinedAt)}</p>
          </div>
        </div>
        <div className="profile-overview-actions">
          <button
            type="button"
            className="neo-btn small logout-btn profile-header-logout-btn"
            onClick={logout}
          >
            退出登录
          </button>
        </div>
      </div>

      <section className="profile-level-panel">
        <div className="profile-level-head">
          <h3>等级进度</h3>
          <div className="profile-level-head-actions">
            <span>
              {levelProgress?.maxLevel
                ? "已满级"
                : `Lv.${dashboardCurrentLevel} -> Lv.${dashboardNextLevel}`}
            </span>
            {!levelProgress?.maxLevel && (
              <button
                type="button"
                className="profile-level-toggle"
                onClick={() => setProfileLevelExpanded((prev) => !prev)}
                aria-expanded={profileLevelExpanded}
              >
                {profileLevelExpanded ? "收起" : "展开"}
              </button>
            )}
          </div>
        </div>

        <div className="profile-level-track">
          <div className="profile-level-track-fill" style={{ width: `${dashboardPercent}%` }} />
        </div>

        <div className="profile-level-track-meta">
          <strong>{dashboardPercent}%</strong>
          {!levelProgress?.maxLevel && (
            <span>
              {Number(levelProgress?.achievedCount || 0)}/
              {Number(levelProgress?.totalCount || 0)}
            </span>
          )}
        </div>

        {profileLevelExpanded &&
          !levelProgress?.maxLevel &&
          dashboardCriteria.length > 0 && (
            <div className="profile-level-grid">
              {dashboardCriteria.map((criterion) => {
                const displayCurrent = criterion.achieved
                  ? criterion.required
                  : criterion.current;
                const title = criterion.achieved
                  ? `${criterion.label || criterion.compactLabel} 已完成`
                  : `${displayCurrent}/${criterion.required}${criterion.unit || ""}`;
                return (
                  <div
                    key={criterion.key}
                    className={`profile-level-cell${criterion.achieved ? " done" : ""}`}
                    title={title}
                  >
                    <span>{criterion.label || criterion.compactLabel}</span>
                    <strong>
                      {criterion.achieved
                        ? "已完成"
                        : `${displayCurrent}/${criterion.required}${criterion.unit || ""}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}

        {profileLevelExpanded &&
          !levelProgress?.maxLevel &&
          dashboardCriteria.length === 0 && (
            <p className="profile-level-empty">
              当前阶段的升级条件都已满足，继续活跃即可升级。
            </p>
          )}
      </section>

      <section className="profile-library-panel">
        <div className="profile-library-head">
          <h3>资料库</h3>
        </div>

        <div className="profile-library-grid">
          <LibraryEntry
            title="点赞"
            count={likedCount}
            icon="heart-filled"
            onClick={() => openProfileLibraryPage("liked")}
          />
          <LibraryEntry
            title="收藏"
            count={favoriteCount}
            icon="star-filled"
            onClick={() => openProfileLibraryPage("favorite")}
          />
          <LibraryEntry
            title="发布"
            count={publishedCount}
            icon="list"
            onClick={() => openProfileLibraryPage("published")}
          />
          <LibraryEntry
            title="通知"
            countText={notificationUnreadCount > 0
              ? `未读 ${notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}`
              : "无未读"}
            icon="bell"
            onClick={openProfileNotificationPage}
          />
        </div>
      </section>

    </>
  );
}
