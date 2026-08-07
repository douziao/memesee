import {
  buildAuthActionLayoutInput,
  buildAuthStateLayoutInput,
} from "./appRuntimeLayoutAuthInputHelpers";

export function buildAuthLayoutInput({ authSession }) {
  return {
    ...buildAuthStateLayoutInput({ authSession }),
    ...buildAuthActionLayoutInput({ authSession }),
  };
}
