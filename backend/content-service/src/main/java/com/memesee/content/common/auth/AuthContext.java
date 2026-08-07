package com.memesee.content.common.auth;

public record AuthContext(String username, int userLevel) {

    public static AuthContext anonymous() {
        return new AuthContext(null, 0);
    }

    public boolean isAuthenticated() {
        return username != null && !username.isBlank();
    }
}
