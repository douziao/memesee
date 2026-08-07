alter table notifications
    add column dedupe_key varchar(255) null;

update notifications
set dedupe_key = concat(
        type,
        ':',
        username,
        ':',
        coalesce(actor_username, ''),
        ':',
        coalesce(cast(main_post_id as char), ''),
        ':',
        coalesce(cast(sub_post_id as char), '-')
    )
where type in (
        'MAIN_POST_LIKED',
        'MAIN_POST_FAVORITED',
        'SUB_POST_LIKED',
        'SUB_POST_FAVORITED'
    )
  and actor_username is not null
  and main_post_id is not null;

delete duplicate_notification
from notifications duplicate_notification
join notifications kept_notification
  on duplicate_notification.dedupe_key = kept_notification.dedupe_key
 and duplicate_notification.id > kept_notification.id
where duplicate_notification.dedupe_key is not null;

create unique index uk_notifications_dedupe_key
    on notifications (dedupe_key);
