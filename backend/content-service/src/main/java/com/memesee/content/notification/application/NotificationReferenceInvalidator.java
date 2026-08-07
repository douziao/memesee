package com.memesee.content.notification.application;

public interface NotificationReferenceInvalidator {

    void invalidateNotificationsReferencingMainPost(Long mainPostId);

    void invalidateNotificationsReferencingSubPost(Long subPostId);
}
