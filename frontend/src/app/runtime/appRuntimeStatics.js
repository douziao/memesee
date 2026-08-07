import {
  communityMarks,
  communityShortDescriptions,
  feedSortModes,
} from "./appRuntimeConfig";
import {
  authorInitial,
  clampText,
  formatDateTime,
  formatTime,
  subPostQuotePreview,
} from "../../shared/state/appHelpers";
import { formatHeatScore } from "../../features/posts/state/mainPostModel";

export const runtimeHelpers = {
  formatTime,
  clampText,
  formatHeatScore,
  formatDateTime,
  authorInitial,
  subPostQuotePreview,
};

export const runtimeLayoutConfig = {
  communityMarks,
  communityShortDescriptions,
  feedSortModes,
};
