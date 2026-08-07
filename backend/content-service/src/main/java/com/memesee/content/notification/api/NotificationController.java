package com.memesee.content.notification.api;


import com.memesee.content.notification.dto.NotificationListResponse;
import com.memesee.content.notification.dto.NotificationReadStateResponse;
import com.memesee.content.notification.application.NotificationApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationApplicationService notificationApplicationService;

    public NotificationController(NotificationApplicationService notificationApplicationService) {
        this.notificationApplicationService = notificationApplicationService;
    }

    @GetMapping
    public NotificationListResponse listNotifications(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Boolean unread,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String actor
    ) {
        return notificationApplicationService.listNotifications(authorizationHeader, limit, unread, type, actor);
    }

    @PatchMapping("/read-state")
    public NotificationReadStateResponse markAllRead(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader
    ) {
        return notificationApplicationService.markAllRead(authorizationHeader);
    }

    @PatchMapping("/{notificationId}/read-state")
    public NotificationReadStateResponse markRead(
            @RequestHeader(name = "Authorization", required = false) String authorizationHeader,
            @PathVariable Long notificationId
    ) {
        return notificationApplicationService.markRead(authorizationHeader, notificationId);
    }
}
