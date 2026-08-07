function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasOwnValue(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key)
    && object[key] !== undefined
    && object[key] !== null;
}

export function resolveNextEngagementActive({
  response,
  activeKey,
  wasActive,
}) {
  if (hasOwnValue(response, activeKey)) {
    return Boolean(response[activeKey]);
  }
  return !Boolean(wasActive);
}

export function resolveNextEngagementCount({
  response,
  countKey,
  currentCount,
  wasActive,
  nextActive,
}) {
  const safeCurrentCount = Math.max(0, toFiniteNumber(currentCount) ?? 0);
  const delta = nextActive === wasActive ? 0 : (nextActive ? 1 : -1);
  const localNextCount = Math.max(0, safeCurrentCount + delta);
  const responseCount = hasOwnValue(response, countKey)
    ? toFiniteNumber(response[countKey])
    : null;

  if (responseCount === null) {
    return localNextCount;
  }
  if (delta !== 0 && responseCount === safeCurrentCount) {
    return localNextCount;
  }
  return Math.max(0, responseCount);
}

export function resolveNextEngagementScore({
  response,
  scoreKey = "hotScore",
}) {
  if (!hasOwnValue(response, scoreKey)) {
    return undefined;
  }
  return toFiniteNumber(response[scoreKey]) ?? undefined;
}
