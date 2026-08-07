create index idx_content_outbox_events_status_created_at_id
    on content_outbox_events (status, created_at asc, id asc);
