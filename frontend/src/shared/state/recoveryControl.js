export const DEFAULT_RECOVERY_BUSY_LABEL = "正在重试...";

export function buildRecoveryControlState({
  isBusy,
  idleLabel = "",
  busyLabel = DEFAULT_RECOVERY_BUSY_LABEL,
  keepIdleLabelWhenBusy = false,
} = {}) {
  const disabled = Boolean(isBusy);
  return {
    disabled,
    label: disabled && !keepIdleLabelWhenBusy ? busyLabel : idleLabel,
  };
}

export function buildRecoveryActionClass({
  action,
  primaryAction,
  baseClassName = "",
  secondaryClassName = "secondary",
} = {}) {
  return [
    baseClassName,
    primaryAction === action ? "" : secondaryClassName,
  ].filter(Boolean).join(" ").trim();
}
