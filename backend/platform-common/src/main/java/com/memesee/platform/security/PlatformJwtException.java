package com.memesee.platform.security;

public class PlatformJwtException extends RuntimeException {

    public PlatformJwtException(String message, Throwable cause) {
        super(message, cause);
    }
}
