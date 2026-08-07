#!/bin/bash
set -eu

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${MYSQL_APP_USERNAME:=memesee_app}"
: "${MYSQL_APP_PASSWORD:?MYSQL_APP_PASSWORD is required}"

sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

APP_USER_ESCAPED="$(sql_escape "$MYSQL_APP_USERNAME")"
APP_PASSWORD_ESCAPED="$(sql_escape "$MYSQL_APP_PASSWORD")"

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE DATABASE IF NOT EXISTS memesee_user CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS memesee_content CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS '${APP_USER_ESCAPED}'@'%' IDENTIFIED BY '${APP_PASSWORD_ESCAPED}';
GRANT ALL PRIVILEGES ON memesee_user.* TO '${APP_USER_ESCAPED}'@'%';
GRANT ALL PRIVILEGES ON memesee_content.* TO '${APP_USER_ESCAPED}'@'%';
FLUSH PRIVILEGES;
EOSQL
