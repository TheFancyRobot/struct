ARG BASE_IMAGE=node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
FROM ${BASE_IMAGE}

USER root
WORKDIR /opt/struct-data-engine
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false --no-audit --no-fund \
  && npm cache clean --force
COPY server.mjs gateway.mjs ./

USER 1000:1000
EXPOSE 4300
CMD ["node", "server.mjs"]
