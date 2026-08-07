package com.memesee.content.common.error;

import com.memesee.platform.error.PlatformGlobalExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler extends PlatformGlobalExceptionHandler {

    @Override
    protected String serviceName() {
        return "content-service";
    }
}
