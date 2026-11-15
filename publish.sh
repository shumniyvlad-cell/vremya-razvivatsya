#!/bin/sh
# Выкладка «Время развиваться» на marchvlv.ru/vremya/ (статика на «Часе»). Анкеты: /vremya/api → 127.0.0.1:8819.
set -eu
cd "$(dirname "$0")"
HOST="root@83.141.94.106"
KEY="$HOME/.ssh/id_ed25519_chas"
ssh -o BatchMode=yes -i "$KEY" "$HOST" 'install -d -m 755 /var/www/vremya'
rsync -rltz --delete --exclude '.DS_Store' --exclude '.git*' --exclude 'server' --exclude 'ACCESS.txt' --exclude 'publish.sh' -e "ssh -o BatchMode=yes -i $KEY" ./ "$HOST:/var/www/vremya/"
ssh -o BatchMode=yes -i "$KEY" "$HOST" 'chmod -R a+rX /var/www/vremya'
ssh -o BatchMode=yes -i "$KEY" "$HOST" 'bash -s' <<'REMOTE'
set -eu
CF=/etc/caddy/Caddyfile
grep -q "handle_path /vremya/\*" "$CF" && { echo "Caddy: без изменений"; exit 0; }
BAK="$CF.bak-vremya-site-$(date +%s)"; cp "$CF" "$BAK"
python3 - "$CF" <<'PY'
import sys
cf=sys.argv[1]; s=open(cf).read()
anchor="\t# «Запуск за день»"
assert anchor in s
block="""\t# «Время развиваться»: встречи по пятницам, статика /var/www/vremya, анкеты → 127.0.0.1:8819
\tredir /vremya /vremya/ 308
\thandle_path /vremya/* {
\t\t@vremyaapi path /api/*
\t\thandle @vremyaapi {
\t\t\treverse_proxy 127.0.0.1:8819
\t\t}
\t\thandle {
\t\t\troot * /var/www/vremya
\t\t\tfile_server
\t\t}
\t}
"""
s=s.replace(anchor, block+anchor, 1); open(cf,"w").write(s)
PY
if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy; echo "Caddy: обновлён (прежний в $BAK)"; else cp "$BAK" "$CF"; echo "Caddyfile не прошёл проверку, вернул прежний"; exit 1; fi
REMOTE
sleep 2
for u in https://marchvlv.ru/vremya/ https://marchvlv.ru/vremya/api/seats https://marchvlv.ru/vremya/img/og.jpg https://marchvlv.ru/ https://marchvlv.ru/den/; do
  printf '%s %s\n' "$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u")" "$u"
done
