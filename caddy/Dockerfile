# Caddy + module DNS Porkbun : certificat Let's Encrypt par validation DNS (aucun port 80/443 requis)
FROM caddy:2-builder AS build
RUN xcaddy build --with github.com/caddy-dns/porkbun

FROM caddy:2-alpine
COPY --from=build /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
