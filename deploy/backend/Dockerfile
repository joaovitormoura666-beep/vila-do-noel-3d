# Opcional: rodar o back-end num contêiner Docker em vez do systemd.
#
#   docker build -t vila-do-noel-backend .
#   docker run -d --name vila-do-noel --restart unless-stopped \
#     --env-file .env -e HOST=0.0.0.0 -e PROXY_CONFIAVEL=172.17.0.1 \
#     -p 127.0.0.1:3000:3000 -v vila-dados:/app/data vila-do-noel-backend
#
# O ".env" é lido pelo Docker (--env-file): escreva os valores sem aspas.
# A porta fica publicada só em 127.0.0.1, para o Caddy da VM repassar.

# Node 22 LTS (com correções de segurança até abril de 2027; depois, troque por node:24-alpine).
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY servidor.mjs ./
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "servidor.mjs"]
