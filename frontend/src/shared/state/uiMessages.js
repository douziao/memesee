import { collectHttpErrorMessages, getHttpErrorStatus } from "../api/httpError";

export const UI_MESSAGES = {
  authRequired: "请先登录后再继续操作。",
  sessionExpired: "登录已过期，请重新登录。",
  methodNotAllowed: "当前操作暂不可用，请刷新后重试。",
  genericOperationFailed: "操作失败，请稍后重试。",
  activitySyncFailed: "用户活跃记录同步失败，请稍后重试。",
  levelProgressLoadFailed: "等级信息加载失败，请稍后重试。",
  notificationsLoadFailed: "通知加载失败，请稍后重试。",
  notificationsMarkReadFailed: "通知标记已读失败，请稍后重试。",
  mainPostDetailLoadFailed: "主帖详情加载失败，请稍后重试。",
  mainPostUnavailable: "主帖已不可用。",
  subPostsLoadFailed: "子帖加载失败，请稍后重试。",
  subPostTargetUnavailable: "未找到这条子帖，可能已被删除或暂不可见。",
  profileLoadFailed: "个人主页加载失败，请稍后重试。",
  communitiesLoadFailed: "社区列表加载失败，请稍后重试。",
  feedLoadFailed: "信息流加载失败，请稍后重试。",
  reportUnavailable: "举报功能暂未开放。",
  usernameRequired: "请输入用户名。",
  registerSuccess: "注册成功。",
  loginSuccess: "登录成功。",
  registerFailed: "注册失败，请稍后重试。",
  loginFailed: "登录失败，请检查账号后重试。",
  logoutSuccess: "已退出登录。",
  onlyAuthorCanEdit: "只有主帖作者可以编辑这条内容。",
  onlyAuthorCanDelete: "只有主帖作者可以删除这条内容。",
  onlySubPostAuthorCanDelete: "只有子帖作者可以删除这条内容。",
  mainPostTitleRequired: "请输入主帖标题。",
  mainPostTitleTooLong: "主帖标题不能超过 30 个字。",
  communityRequired: "请选择社区。",
  richMediaRequired: "图文模式至少上传 1 张图片。",
  mainPostContentRequired: "请输入主帖内容。",
  mainPostCreated: "主帖发布成功。",
  mainPostUpdated: "主帖已更新。",
  mainPostCreateFailed: "主帖发布失败，请稍后重试。",
  mainPostUpdateFailed: "主帖更新失败，请稍后重试。",
  mainPostDeleted: "主帖已删除。",
  mainPostDeleteFailed: "主帖删除失败，请稍后重试。",
  postShared: "分享已发送。",
  subPostShared: "子帖定位链接已分享。",
  postLinkCopied: "分享已复制。",
  subPostLinkCopied: "定位分享已复制。",
  subPostLocationLinkCopied: "子帖定位链接已复制。",
  subPostLocationLinkCopyFailed: "子帖定位链接复制失败，请稍后重试。",
  postShareCanceled: "已取消分享。",
  postShareFailed: "分享或复制未成功，请稍后重试。",
  subPostShareFailed: "定位链接未能分享，请稍后重试。",
  mediaUploadCommunityRequired: "请先选择社区，再上传附件。",
  mediaUploadFailed: "附件上传失败，请稍后重试。",
  emptySubPostPreview: "这条子帖没有可引用的正文预览。",
  subPostContentRequired: "请输入子帖内容或上传图片。",
  subPostCreated: "子帖发布成功。",
  subPostCreateFailed: "子帖发布失败，请稍后重试。",
  subPostDeleted: "子帖已删除。",
  subPostDeleteFailed: "子帖删除失败，请稍后重试。",
};

const MOJIBAKE_MARKERS = [
  "闂",
  "鍊",
  "鐧",
  "閻",
  "婵",
  "濞",
  "绱",
  "鈧",
  "锟",
  "\uFFFD",
];

function looksLikeMojibake(value) {
  return MOJIBAKE_MARKERS.some((marker) => value.includes(marker));
}

export function sanitizeUiText(value, fallback = UI_MESSAGES.genericOperationFailed) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }
  if (looksLikeMojibake(normalized)) {
    return fallback;
  }
  return normalized;
}

export function readableError(error, fallback = UI_MESSAGES.genericOperationFailed) {
  const status = getHttpErrorStatus(error);

  if (status === 401) {
    return UI_MESSAGES.sessionExpired;
  }
  if (status === 405) {
    return UI_MESSAGES.methodNotAllowed;
  }

  const candidates = collectHttpErrorMessages(error);
  candidates.push(fallback);

  for (const candidate of candidates) {
    const normalized = sanitizeUiText(candidate, "");
    if (normalized) {
      return normalized;
    }
  }

  return sanitizeUiText(fallback, UI_MESSAGES.genericOperationFailed);
}
