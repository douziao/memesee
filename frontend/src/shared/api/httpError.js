function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function normalizeDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return {};
  }
  return details;
}

function pushDetailMessages(candidates, details) {
  Object.values(details).forEach((value) => {
    if (typeof value === "string") {
      candidates.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string") {
          candidates.push(item);
        }
      });
    }
  });
}

export function normalizeApiErrorPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      code: "",
      message: "",
      requestId: "",
      details: {},
    };
  }

  return {
    code: normalizeString(payload.code),
    message: normalizeString(payload.message),
    requestId: normalizeString(payload.requestId),
    details: normalizeDetails(payload.details),
  };
}

export function normalizeHttpError(error) {
  const response = error?.response;
  const payload = response?.data;
  const normalizedPayload = normalizeApiErrorPayload(payload);
  const payloadText = typeof payload === "string" ? normalizeString(payload) : "";
  const fallbackMessage = normalizeString(error?.message);

  return {
    status: Number(response?.status || 0),
    code: normalizedPayload.code,
    message: normalizedPayload.message || payloadText || fallbackMessage,
    requestId: normalizedPayload.requestId,
    details: normalizedPayload.details,
    isNetworkError: !response,
  };
}

export function getHttpErrorStatus(error) {
  if (Number.isFinite(Number(error?.memesee?.status))) {
    return Number(error.memesee.status);
  }
  return normalizeHttpError(error).status;
}

export function collectHttpErrorMessages(error) {
  const response = error?.response;
  const payload = response?.data;
  const normalizedError = error?.memesee && typeof error.memesee === "object"
    ? error.memesee
    : normalizeHttpError(error);
  const candidates = [];

  if (typeof payload === "string") {
    candidates.push(payload);
  }
  if (normalizedError.message) {
    candidates.push(normalizedError.message);
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (typeof payload.error === "string") {
      candidates.push(payload.error);
    }
    pushDetailMessages(candidates, normalizeDetails(payload.details));
    Object.entries(payload).forEach(([key, value]) => {
      if (
        typeof value === "string"
        && !["timestamp", "path", "trace", "error", "message", "code", "requestId"].includes(key)
      ) {
        candidates.push(value);
      }
    });
  }
  if (typeof error?.message === "string") {
    candidates.push(error.message);
  }

  return candidates
    .map((candidate) => normalizeString(candidate))
    .filter(Boolean);
}

export function attachHttpErrorInterceptor(client) {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error && typeof error === "object") {
        error.memesee = normalizeHttpError(error);
      }
      return Promise.reject(error);
    },
  );
  return client;
}
