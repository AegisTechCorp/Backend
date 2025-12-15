FROM node:20-alpine

WORKDIR /app

# Dépendances de build pour bcrypt et autres modules natifs (argon2, etc.)
RUN apk add --no-cache python3 make g++

# Copier les fichiers package pour installer les dépendances
COPY package*.json ./
RUN npm ci

# Copier tout le code source
COPY . .

# Builder l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Démarrer en mode production (node direct = plus rapide)
CMD ["node", "dist/main.js"]