# VPS deployment

1. DNS: `A`/`AAAA` records for `protocap.akiksystems.fr` and `demo.protocap.akiksystems.fr`.
2. TLS: `certbot certonly --nginx -d protocap.akiksystems.fr` and `-d demo.protocap.akiksystems.fr`.
3. nginx: install `nginx/protocap.conf` in `/etc/nginx/conf.d/`, then `nginx -t && systemctl reload nginx`.
4. Env: copy `protocap.env.example` → `protocap.env` (secrets) and `protocap-demo.env.example` → `protocap-demo.env`.
5. Run: `docker compose up -d --build` from this directory.
6. Check: `curl -fsS https://protocap.akiksystems.fr/api/ready` and `https://demo.protocap.akiksystems.fr/api/ready`; `https://protocap.akiksystems.fr/api/public-demo` must return `available: true`.

The demo uses fictitious data and a scripted Céline provider; it never receives the real ShiftGuide code or AI key.
See `docs/release-and-operations.md` and `docs/ingress-trust.md`.
