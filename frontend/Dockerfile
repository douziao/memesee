ARG FRONTEND_NODE_IMAGE=node:22-alpine
ARG FRONTEND_NGINX_IMAGE=nginx:1.27-alpine

FROM ${FRONTEND_NODE_IMAGE} AS build
WORKDIR /app

ARG VITE_API_BASE=""
ENV VITE_API_BASE=${VITE_API_BASE}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM ${FRONTEND_NGINX_IMAGE}
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
