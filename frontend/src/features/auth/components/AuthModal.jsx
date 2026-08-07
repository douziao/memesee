import UiIcon from "../../../shared/components/UiIcon";

export default function AuthModal({
  authModalOpen,
  isLoggedIn,
  mode,
  username,
  password,
  inviteCode,
  authing,
  setMode,
  setUsername,
  setPassword,
  setInviteCode,
  submitAuth,
  closeAuthModal,
}) {
  if (!authModalOpen || isLoggedIn) {
    return null;
  }

  return (
    <div className="post-detail-overlay auth-modal-overlay" onClick={closeAuthModal}>
      <div
        className="auth-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-modal-head">
          <div className="auth-modal-title">
            <span className="auth-modal-stamp">MEMESEE</span>
            <h3>{mode === "register" ? "邀请码注册" : "账号登录"}</h3>
          </div>
          <button
            type="button"
            className="auth-close-button"
            onClick={closeAuthModal}
            disabled={authing}
            aria-label="关闭"
          >
            <UiIcon name="close" />
          </button>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="账号操作">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>

        <form onSubmit={submitAuth} className="auth-modal-form">
          <label className="auth-field">
            <span>用户名</span>
            <input
              placeholder="输入用户名"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              required
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </label>

          {mode === "register" ? (
            <label className="auth-field auth-field-invite">
              <span>邀请码</span>
              <input
                placeholder="输入邀请码"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="one-time-code"
                maxLength={64}
                required
              />
            </label>
          ) : null}

          <button type="submit" className="auth-submit-button" disabled={authing}>
            {authing ? "处理中..." : mode === "register" ? "注册并登录" : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
