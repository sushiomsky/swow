FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# NEXT_PUBLIC_* wird zur Build-Zeit ins Client-Bundle eingebacken.
# ARG-Deklaration (Werte kommen aus docker-compose build.args; Defaults sind
# bewusst Edge/Prod-sicher: relativ statt localhost).
ARG NEXT_PUBLIC_GAME_BASE=""
ARG NEXT_PUBLIC_COMMUNITY_API_BASE="/api/community"
ARG NEXT_PUBLIC_COMMUNITY_SOCKET_URL=""
ARG NEXT_PUBLIC_ACTIVE_GAMES_URL="/multiplayer/active-games"
ARG NEXT_PUBLIC_SITE_URL="https://wizardofwor.duckdns.org"
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
