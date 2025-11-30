# Aegis API - Backend Zero-Knowledge

API backend pour l'application Aegis, une plateforme de gestion de dossiers médicaux avec architecture **Zero-Knowledge** garantissant que même les administrateurs ne peuvent pas lire les données des utilisateurs.

## Table des matières

1. [À propos du projet](#à-propos-du-projet)
2. [Architecture Zero-Knowledge](#architecture-zero-knowledge)
3. [Technologies utilisées](#technologies-utilisées)
4. [Prérequis](#prérequis)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Démarrage](#démarrage)
8. [Structure du projet](#structure-du-projet)
9. [API Endpoints](#api-endpoints)
10. [Sécurité](#sécurité)
11. [Tests](#tests)

---

## À propos du projet

**Aegis** est une application HealthTech qui permet aux utilisateurs de stocker et gérer leurs dossiers médicaux en toute sécurité. La particularité d'Aegis est son architecture **Zero-Knowledge** : toutes les données sensibles sont chiffrées côté client avant d'être envoyées au serveur, garantissant une confidentialité maximale.

### Fonctionnalités principales

- Authentification sécurisée avec architecture Zero-Knowledge
- Gestion de dossiers médicaux chiffrés de bout en bout (E2EE)
- Upload et téléchargement de fichiers médicaux chiffrés
- Statistiques sur les dossiers médicaux
- Protection contre les attaques IDOR, XSS, injection SQL
- Rate limiting et sécurité renforcée

---

## Architecture Hybride : Authentification + Zero-Knowledge

### Approche en Deux Couches

L'architecture combine deux systèmes complémentaires :

**1. Authentification Classique (Bcrypt)**
- Le mot de passe est hashé avec **Bcrypt** (12 rounds) pour l'authentification
- Permet de vérifier l'identité de l'utilisateur lors de la connexion
- Stocké sécurisé en base de données

**2. Vault Zero-Knowledge (Chiffrement E2EE)**
- Les données sensibles sont chiffrées côté client avec une `masterKey`
- La `masterKey` est dérivée du mot de passe + vaultSalt (PBKDF2)
- Le serveur ne peut **JAMAIS** déchiffrer les données de l'utilisateur
- En cas de compromission du serveur, les données restent protégées


## Technologies utilisées

### Framework et runtime

- **Node.js** (v18+)
- **NestJS** 11.x - Framework backend TypeScript
- **TypeScript** 5.x

### Base de données

- **PostgreSQL** 15+ - Base de données relationnelle
- **TypeORM** 0.3.x - ORM pour TypeScript

### Sécurité

- **Bcrypt** - Hash des mots de passe pour authentification (12 rounds)
- **JWT (JsonWebToken)** - Authentification stateless
- **Passport** - Middleware d'authentification
- **cookie-parser** - Gestion sécurisée des cookies HttpOnly

### Upload de fichiers

- **Multer** - Gestion des uploads multipart/form-data

### Documentation

- **Swagger (OpenAPI)** - Documentation interactive de l'API

---

## Prérequis

- **Node.js** 18+ et **npm** 9+
- **PostgreSQL** 15+
- **Git**

---

## Installation

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd backend
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la base de données

Créer une base de données PostgreSQL :

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE aegis_db;

# Créer un utilisateur (optionnel)
CREATE USER aegis_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE aegis_db TO aegis_user;
```

---

## Configuration

### Variables d'environnement

Créer un fichier `.env.local` à la racine du projet :

```bash
cp .env.example .env.local
```

Éditer `.env.local` avec vos valeurs :

```env
# Environment
NODE_ENV=development

# Server
PORT=3000

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=aegis_user
DATABASE_PASSWORD=votre_mot_de_passe
DATABASE_NAME=aegis_db
DATABASE_SSL=false

# JWT Secrets (CHANGEZ-LES EN PRODUCTION!)
JWT_ACCESS_SECRET=votre-secret-access-token-tres-securise
JWT_REFRESH_SECRET=votre-secret-refresh-token-tres-securise
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (pour CORS)
FRONTEND_URL=http://localhost:5173
```

**IMPORTANT** : Changez les secrets JWT en production avec des valeurs aléatoires fortes :

```bash
# Générer des secrets forts
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Démarrage

### Mode développement

```bash
npm run start:dev
```

L'API sera accessible sur `http://localhost:3000`

### Mode production

```bash
# Build
npm run build

# Démarrer
npm run start:prod
```

### Accéder à la documentation Swagger

Ouvrir `http://localhost:3000/api` dans votre navigateur pour voir la documentation interactive de l'API.

---

## Structure du projet

```
src/
├── auth/                       # Module d'authentification
│   ├── controllers/
│   │   └── auth.controller.ts  # Endpoints: register, login, refresh, logout
│   ├── dto/                    # DTOs de validation
│   ├── entities/
│   │   └── refresh-token.entity.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts   # Protection des routes
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── utils/
│   │   └── crypto.utils.ts     # Utilitaires Argon2
│   ├── auth.module.ts
│   └── auth.service.ts         # Logique métier auth
│
├── users/                      # Module utilisateurs
│   ├── entities/
│   │   └── user.entity.ts      # Entité User (authHash, vaultSalt)
│   ├── users.service.ts
│   └── users.module.ts
│
├── medical-records/            # Module dossiers médicaux
│   ├── controllers/
│   │   └── medical-records.controller.ts
│   ├── dto/
│   ├── entities/
│   │   └── medical-record.entity.ts  # Données chiffrées
│   ├── medical-records.service.ts
│   └── medical-records.module.ts
│
├── files/                      # Module fichiers chiffrés
│   ├── controllers/
│   │   └── files.controller.ts
│   ├── dto/
│   ├── entities/
│   │   └── file-attachment.entity.ts
│   ├── services/
│   │   ├── files.service.ts
│   │   └── file-encryption.service.ts  # Stockage sécurisé
│   └── files.module.ts
│
├── config/                     # Configuration
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── security.config.ts
│
├── app.module.ts               # Module racine
└── main.ts                     # Point d'entrée
```

---

## API Endpoints

### Documentation complète

Voir la documentation Swagger interactive : `http://localhost:3000/api`

### Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/register` | Inscription (reçoit authHash) |
| POST | `/auth/login` | Connexion (reçoit authHash) |
| POST | `/auth/refresh` | Rafraîchir les tokens |
| POST | `/auth/logout` | Déconnexion |

### Dossiers médicaux

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/medical-records` | Créer un dossier chiffré | JWT |
| GET | `/medical-records` | Liste des dossiers de l'utilisateur | JWT |
| GET | `/medical-records/statistics` | Statistiques par type | JWT |
| GET | `/medical-records/:id` | Détails d'un dossier | JWT |
| PATCH | `/medical-records/:id` | Modifier un dossier | JWT |
| DELETE | `/medical-records/:id` | Supprimer un dossier | JWT |

### Fichiers

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| POST | `/files/medical-records/:id/upload` | Upload fichier chiffré | JWT |
| GET | `/files/medical-records/:id` | Liste des fichiers | JWT |
| GET | `/files/:id/download` | Télécharger un fichier | JWT |
| DELETE | `/files/:id` | Supprimer un fichier | JWT |

### Exemples de requêtes

#### Inscription

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MotDePasseSecurise123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Note** : Le mot de passe est envoyé en clair (via HTTPS). Le serveur le hashe avec Bcrypt.

#### Connexion

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MotDePasseSecurise123!"
  }'
```

#### Créer un dossier médical

```bash
curl -X POST http://localhost:3000/medical-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "type": "prescription",
    "encryptedData": "U2FsdGVkX1...",
    "encryptedIv": "aGVsbG93b3JsZA=="
  }'
```

---

## Sécurité

### Mesures de sécurité implémentées

#### 1. Authentification Hybride (Bcrypt + Zero-Knowledge Vault)

- Authentification : Bcrypt (12 rounds) pour hasher les mots de passe
- Chiffrement E2EE : masterKey dérivée avec PBKDF2 (100 000 itérations)
- Séparation : password (auth) / masterKey (chiffrement données)

#### 2. Protection des tokens

- Access Token : JWT, durée courte (15min)
- Refresh Token : Stocké en base, rotation à usage unique
- Cookies HttpOnly, Secure, SameSite=Strict

#### 3. Validation des données

- DTOs avec `class-validator`
- Whitelist stricte (`whitelist: true`)
- Validation du format authHash (44 caractères base64)

#### 4. Protection contre les attaques courantes

- **IDOR** : Vérification userId sur toutes les requêtes
- **XSS** : Headers de sécurité, sanitization côté client
- **Injection SQL** : ORM TypeORM (requêtes paramétrées)
- **CSRF** : Cookies SameSite=Strict
- **Bruteforce** : Rate limiting (à configurer)

#### 5. Chiffrement des données

- Données médicales : Chiffrées côté client (AES-GCM)
- Fichiers : Stockés chiffrés sur disque
- Base de données : Données illisibles sans masterKey

## Tests

### Lancer les tests unitaires

```bash
npm run test
```

### Lancer les tests e2e

```bash
npm run test:e2e
```

