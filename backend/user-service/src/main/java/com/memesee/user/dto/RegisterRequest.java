package com.memesee.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "用户名不能为空。") @Size(min = 3, max = 50, message = "用户名长度必须为 3 到 50 个字符。") String username,
        @NotBlank(message = "密码不能为空。") @Size(min = 6, max = 64, message = "密码长度必须为 6 到 64 个字符。") String password,
        @NotBlank(message = "请输入邀请码。") @Size(min = 4, max = 64, message = "邀请码长度必须为 4 到 64 个字符。") String inviteCode
) {
}

