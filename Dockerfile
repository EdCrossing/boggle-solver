FROM node:22-alpine
RUN apk add --no-cache words
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server.mjs"]
