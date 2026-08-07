export default function DetailHeader({
  selectedPost,
  authorInitial,
  formatTime,
}) {
  const hasTags = Array.isArray(selectedPost.tags) && selectedPost.tags.length > 0;

  return (
    <div className="post-detail-head article-head">
      <h2>{selectedPost.title}</h2>

      <div className="detail-post-taxonomy">
        <span className="detail-community-tag-text">
          {selectedPost.communityName || selectedPost.communitySlug}
        </span>
        {hasTags && (
          <div className="detail-tag-list">
            {selectedPost.tags.map((tag) => (
              <span
                key={`detail-${selectedPost.id}-${tag}`}
                className="detail-tag-chip-text"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="post-detail-owner-top">
        <div className="post-author-avatar">
          {authorInitial(selectedPost.author)}
        </div>
        <div className="post-detail-owner-meta">
          <strong className="post-author-name">{selectedPost.author}</strong>
          <span>{formatTime(selectedPost.createdAt, selectedPost.createdAtText)}</span>
        </div>
      </div>
    </div>
  );
}
