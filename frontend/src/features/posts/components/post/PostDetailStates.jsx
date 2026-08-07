import { StatusCard } from "../../../../shared/components/PageShell";
import {
  buildRecoveryActionClass,
  buildRecoveryControlState,
} from "../../../../shared/state/recoveryControl";
import { POST_DETAIL_ERROR_TYPES } from "../../state/postDetailQueryRuntimeHelpers";

export function PostDetailLoadingState() {
  return (
    <article
      className="post-detail-paper post-detail-skeleton"
      role="status"
      aria-live="polite"
      aria-label="正在加载主帖详情"
    >
      <div className="post-detail-skeleton-head">
        <span className="detail-skeleton-line detail-skeleton-title" />
        <span className="detail-skeleton-line detail-skeleton-title short" />
        <div className="detail-skeleton-taxonomy">
          <span className="detail-skeleton-line detail-skeleton-chip" />
          <span className="detail-skeleton-line detail-skeleton-chip small" />
        </div>
        <div className="detail-skeleton-owner">
          <span className="detail-skeleton-avatar" />
          <div className="detail-skeleton-owner-meta">
            <span className="detail-skeleton-line detail-skeleton-name" />
            <span className="detail-skeleton-line detail-skeleton-time" />
          </div>
        </div>
      </div>

      <div className="detail-skeleton-content" aria-hidden="true">
        <span className="detail-skeleton-line" />
        <span className="detail-skeleton-line wide" />
        <span className="detail-skeleton-line medium" />
        <span className="detail-skeleton-block" />
      </div>

      <div className="detail-skeleton-actions" aria-hidden="true">
        <span className="detail-skeleton-pill" />
        <span className="detail-skeleton-pill" />
        <span className="detail-skeleton-pill narrow" />
      </div>
    </article>
  );
}

export function buildPostDetailRetryCopy(errorType) {
  if (errorType === POST_DETAIL_ERROR_TYPES.notFound) {
    return {
      title: "主帖已不可用",
      description: "这条内容可能已经被删除，或链接里的帖子编号不存在。",
      subtext: "建议返回首页继续浏览；如果刚刚恢复了网络，也可以再确认一次状态。",
      tone: "empty",
      primaryAction: "home",
    };
  }

  return {
    title: "主帖暂时加载失败",
    description: "网络或服务刚才没有响应成功，内容不一定已经消失。",
    subtext: "可以稍后重试加载，或返回首页继续浏览其它内容。",
    tone: "default",
    primaryAction: "retry",
  };
}

export function postDetailRetryActionClass(copy, action) {
  return buildRecoveryActionClass({
    action,
    primaryAction: copy?.primaryAction,
    baseClassName: "neo-btn small",
  });
}

export function buildPostDetailRetryControlState({ action, refreshing } = {}) {
  const isRetryAction = action === "retry";
  return buildRecoveryControlState({
    isBusy: refreshing,
    idleLabel: isRetryAction ? "重试加载" : "返回首页",
    keepIdleLabelWhenBusy: !isRetryAction,
  });
}

export function PostDetailRetryState({
  postDetailErrorType,
  refreshingCurrentPostThread,
  refreshCurrentPostThread,
  backToLatest,
}) {
  const copy = buildPostDetailRetryCopy(postDetailErrorType);
  const homeControl = buildPostDetailRetryControlState({
    action: "home",
    refreshing: refreshingCurrentPostThread,
  });
  const retryControl = buildPostDetailRetryControlState({
    action: "retry",
    refreshing: refreshingCurrentPostThread,
  });

  return (
    <StatusCard
      title={copy.title}
      description={copy.description}
      className={copy.tone === "empty" ? "feed-status-card-empty" : ""}
      tone={copy.tone}
    >
      <span className="feed-status-subtext">{copy.subtext}</span>
      <div className="btn-group">
        <button
          type="button"
          className={postDetailRetryActionClass(copy, "home")}
          onClick={backToLatest}
          disabled={homeControl.disabled}
        >
          {homeControl.label}
        </button>
        <button
          type="button"
          className={postDetailRetryActionClass(copy, "retry")}
          onClick={refreshCurrentPostThread}
          disabled={retryControl.disabled}
        >
          {retryControl.label}
        </button>
      </div>
    </StatusCard>
  );
}
