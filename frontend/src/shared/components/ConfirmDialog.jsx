import { useEffect, useRef, useState } from "react";
import UiIcon from "./UiIcon";
import { registerConfirmDialogHandler } from "../platform/browserDialog";

const DEFAULT_CONFIRM = {
  title: "确认操作",
  message: "",
  confirmLabel: "确认",
  cancelLabel: "取消",
  variant: "default",
};

export default function ConfirmDialog() {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  useEffect(() => {
    return registerConfirmDialogHandler((options = {}) => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setDialog({
          ...DEFAULT_CONFIRM,
          ...options,
        });
      });
    });
  }, []);

  function close(result) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolve?.(result);
  }

  useEffect(() => {
    if (!dialog) {
      return undefined;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        close(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialog]);

  if (!dialog) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay" role="presentation" onMouseDown={() => close(false)}>
      <section
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-head">
          <h3 id="confirm-dialog-title">{dialog.title}</h3>
          <button
            type="button"
            className="confirm-dialog-close"
            onClick={() => close(false)}
            aria-label="关闭"
          >
            <UiIcon name="close" />
          </button>
        </div>
        <p>{dialog.message}</p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-btn"
            onClick={() => close(false)}
          >
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn primary ${dialog.variant === "danger" ? "danger" : ""}`}
            onClick={() => close(true)}
            autoFocus
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
