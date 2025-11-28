FROM node:22-alpine

WORKDIR /app

# Copier les fichiers package pour installer les dépendances
COPY package*.json ./
RUN npm ci

# Copier tout le code source
COPY . .

# Builder l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Démarrer en mode production
CMD ["npm", "run", "start:prod"]