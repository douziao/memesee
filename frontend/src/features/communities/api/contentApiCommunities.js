/**
 * @param {{ get: Function }} client
 */
export async function listCommunities(client) {
  const response = await client.get("/api/communities");
  const payload = Array.isArray(response?.data) ? response.data : [];
  return payload.map((community) => ({
    id: Number(community?.id || 0),
    slug: String(community?.slug || ""),
    name: String(community?.name || community?.slug || ""),
    description: String(community?.description || ""),
    sortOrder: Number(community?.sortOrder || 0),
  }));
}
