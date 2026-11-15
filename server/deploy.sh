#!/bin/sh
# Выкладка сервиса анкет на сервер «Час». Пароль админки живёт только в /etc/vremya-leads/env.
set -eu
HOST="root@83.141.94.106"
KEY="$HOME/.ssh/id_ed25519_chas"
cd "$(dirname "$0")"
ssh -i "$KEY" "$HOST" 'mkdir -p /opt/vremya-leads'
rsync -az -e "ssh -i $KEY" server.mjs admin.html "$HOST:/opt/vremya-leads/"
rsync -az -e "ssh -i $KEY" vremya-leads.service "$HOST:/etc/systemd/system/vremya-leads.service"
ssh -i "$KEY" "$HOST" 'systemctl daemon-reload && systemctl enable -q vremya-leads && systemctl restart vremya-leads && sleep 2 && systemctl is-active vremya-leads && curl -s http://127.0.0.1:8819/health'
