import { buildAccountEntryOpenOptions } from "../accountEntryHelpers";

export default function SideGaugeCard({ shellProps, progressProps, actionProps }) {
  const { isLoggedIn, view, authModalOpen, notificationUnreadCount, currentUser } =
    shellProps;
  const { dashboardPercent, dashboardCurrentLevel, levelProgress } = progressProps;
  const { openMineView, openAuthModal } = actionProps;

  return (
    <section className="side-gauge-card">
      <button
        type="button"
        className={`side-gauge-trigger ${
          (isLoggedIn && view === "mine") || (!isLoggedIn && authModalOpen)
            ? "active"
            : ""
        } ${isLoggedIn && notificationUnreadCount > 0 ? "has-notify" : ""}`}
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
        title={isLoggedIn ? `${currentUser} 的个人中心` : "登录 / 注册"}
      >
        <div
          className="side-level-gauge"
          style={{ "--progress": `${isLoggedIn ? dashboardPercent : 0}%` }}
        >
          {isLoggedIn && notificationUnreadCount > 0 && (
            <span
              className="side-gauge-unread"
              aria-label={`未读通知 ${notificationUnreadCount}`}
            >
              {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
            </span>
          )}
          <div className="side-level-gauge-inner">
            {isLoggedIn ? (
              <>
                <strong className="side-gauge-level">Lv.{dashboardCurrentLevel}</strong>
                <span className="side-gauge-caption">个人中心</span>
                <em className="side-level-gauge-meta">
                  {levelProgress?.maxLevel ? "满级" : `${dashboardPercent}%`}
                </em>
              </>
            ) : (
              <>
                <strong className="side-gauge-level">账户</strong>
                <span className="side-gauge-caption">登录 / 注册</span>
              </>
            )}
          </div>
        </div>
      </button>
    </section>
  );
}
