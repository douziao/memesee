import axios from "axios";
import { attachHttpErrorInterceptor } from "./httpError";

export function createApiClient({ baseURL } = {}) {
  const client = axios.create({ baseURL });
  return attachHttpErrorInterceptor(client);
}
