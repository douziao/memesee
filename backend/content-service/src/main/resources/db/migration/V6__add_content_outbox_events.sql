create table content_outbox_events (
    id bigint not null auto_increment,
    aggregate_type varchar(80) not null,
    aggregate_id varchar(120) not null,
    event_type varchar(120) not null,
    payload_json longtext not null,
    status varchar(20) not null,
    attempt_count int not null default 0,
    available_at timestamp(6) not null default current_timestamp(6),
    processed_at timestamp(6) null,
    last_error varchar(1000) null,
    created_at timestamp(6) not null default current_timestamp(6),
    primary key (id)
);

create index idx_content_outbox_events_status_available_at
    on content_outbox_events (status, available_at asc, id asc);

create index idx_content_outbox_events_aggregate
    on content_outbox_events (aggregate_type, aggregate_id, id desc);
