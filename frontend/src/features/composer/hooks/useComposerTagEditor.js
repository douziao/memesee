import { useRef, useState } from "react";
import {
  buildComposerTagState,
  isComposerTagSubmitKey,
} from "../state/composerDraftHelpers";

function focusComposerTagInput(inputRef) {
  window.setTimeout(() => {
    inputRef.current?.focus();
  }, 0);
}

export function useComposerTagEditor({ setMessage }) {
  const [composerTags, setComposerTags] = useState([]);
  const [composerTagDraft, setComposerTagDraft] = useState("");
  const [showTagEditor, setShowTagEditor] = useState(false);
  const composerTagInputRef = useRef(null);

  function resetComposerTagEditor() {
    setComposerTags([]);
    setComposerTagDraft("");
    setShowTagEditor(false);
  }

  function closeComposerTagEditor() {
    if (composerTagDraft.trim()) {
      const { normalizedTagItems, validationMessage } = resolveComposerTags();
      if (validationMessage) {
        setMessage(validationMessage);
        return;
      }
      syncResolvedComposerTags(normalizedTagItems);
    }
    setShowTagEditor(false);
  }

  function hydrateComposerTags(tags) {
    setComposerTags(Array.isArray(tags) ? tags.slice(0, 3) : []);
    setComposerTagDraft("");
    setShowTagEditor(false);
  }

  function resolveComposerTags() {
    return buildComposerTagState(composerTags, composerTagDraft);
  }

  function syncResolvedComposerTags(normalizedTagItems) {
    setComposerTags(normalizedTagItems);
    setComposerTagDraft("");
  }

  function addComposerTag() {
    if (!composerTagDraft.trim()) {
      return;
    }
    const { normalizedTagItems, validationMessage } = resolveComposerTags();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    syncResolvedComposerTags(normalizedTagItems);
    if (normalizedTagItems.length >= 3) {
      setShowTagEditor(false);
      return;
    }
    focusComposerTagInput(composerTagInputRef);
  }

  function removeComposerTag(tag) {
    setComposerTags((prev) => prev.filter((item) => item !== tag));
    setComposerTagDraft("");
    setShowTagEditor(false);
  }

  function toggleComposerTagEditor() {
    if (showTagEditor) {
      addComposerTag();
      setShowTagEditor(false);
      return;
    }
    setShowTagEditor(true);
    focusComposerTagInput(composerTagInputRef);
  }

  function handleComposerTagInputKeyDown(event) {
    if (!isComposerTagSubmitKey(event.key)) {
      return;
    }
    event.preventDefault();
    addComposerTag();
  }

  return {
    composerTags,
    composerTagDraft,
    showTagEditor,
    composerTagInputRef,
    setComposerTagDraft,
    resetComposerTagEditor,
    closeComposerTagEditor,
    hydrateComposerTags,
    resolveComposerTags,
    syncResolvedComposerTags,
    addComposerTag,
    removeComposerTag,
    toggleComposerTagEditor,
    handleComposerTagInputKeyDown,
  };
}
