ALTER TABLE users
    ADD COLUMN email VARCHAR(255) NULL AFTER username,
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER email;

CREATE UNIQUE INDEX uk_users_email ON users (email);
