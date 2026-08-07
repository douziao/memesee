delete from content_outbox_events
where event_type = 'content.feed.main-post.changed';
