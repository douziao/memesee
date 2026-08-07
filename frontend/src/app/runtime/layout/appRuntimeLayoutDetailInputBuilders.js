import { buildDetailQueryLayoutInput } from "./appRuntimeLayoutDetailQueryInputHelpers";
import { buildDetailPresentationLayoutInput } from "./appRuntimeLayoutDetailPresentationInputHelpers";

export function buildDetailLayoutInput({
  appChrome,
  queryRuntimes,
  postDetailView,
  mainPostEngagement,
  queryRuntimeRefreshInterface,
}) {
  return {
    ...buildDetailQueryLayoutInput({
      detailQueryRuntime: queryRuntimes.detailQueryRuntime,
      queryRuntimeRefreshInterface,
      mainPostEngagement,
    }),
    ...buildDetailPresentationLayoutInput({
      appChrome,
      postDetailView,
    }),
  };
}

export function buildSubPostThreadLayoutInput({ subPostThreadState }) {
  return subPostThreadState;
}
