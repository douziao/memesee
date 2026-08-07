import { buildAccountEntryOpenOptions } from "../accountEntryHelpers";

export default function TopNavActions({
  isLoggedIn,
  currentUser,
  notificationUnreadCount,
  view,
  authModalOpen,
  openMineView,
  openAuthModal,
  openComposer,
}) {
  return (
    <nav className="top-nav">
      <button
        type="button"
        className={`top-profile-mini-btn ${
          (isLoggedIn && view === "mine") || (!isLoggedIn && authModalOpen)
            ? "active"
            : ""
        }`}
        onClick={() => {
          if (isLoggedIn) {
            openMineView(buildAccountEntryOpenOptions({
              isLoggedIn,
              notificationUnreadCount,
            }));
            return;
          }
          openAuthModal("login");
        }}
        title={isLoggedIn ? "个人中心" : "登录 / 注册"}
        aria-label={isLoggedIn ? "打开个人中心" : "登录或注册"}
      >
        <span className="top-profile-mini-mark" aria-hidden="true">
          {isLoggedIn ? (currentUser || "U").slice(0, 1).toUpperCase() : "人"}
        </span>
        {isLoggedIn && notificationUnreadCount > 0 && (
          <span className="top-profile-mini-badge" aria-hidden="true">
            {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
          </span>
        )}
      </button>
      <button
        type="button"
        className="top-create-btn"
        onClick={openComposer}
      >
        {isLoggedIn ? "发布主帖" : "登录后发帖"}
      </button>
    </nav>
  );
}
