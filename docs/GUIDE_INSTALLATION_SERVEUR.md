# 🖥️ GUIDE D'INSTALLATION SERVEUR

Ce guide détaille l'installation complète du serveur Pieuvre Auto sur un serveur Windows ou Linux.

---

## 📋 Prérequis

### Matériel
- **CPU** : 2 cœurs minimum (4 recommandé)
- **RAM** : 4 GB minimum (8 GB recommandé)
- **Disque** : 20 GB minimum
- **Réseau** : Carte réseau avec IP fixe

### Logiciels
- **OS** : Windows Server 2019+ ou Ubuntu 22.04+
- **PostgreSQL** : Version 16
- **Node.js** : Version 18 ou supérieure
- **npm** : Inclus avec Node.js

---

## 🔧 INSTALLATION WINDOWS SERVER

### Étape 1 : Installer PostgreSQL

1. Télécharger PostgreSQL 16 :
   ```
   https://www.postgresql.org/download/windows/
   ```

2. Lancer l'installateur :
   - Port : **5432** (par défaut)
   - Mot de passe postgres : **choisir un mot de passe fort**
   - Locale : **French, France**

3. Ajouter au PATH (si pas fait auto) :
   ```
   C:\Program Files\PostgreSQL\16\bin
   ```

4. Tester l'installation :
   ```cmd
   psql --version
   ```

### Étape 2 : Créer la base de données

1. Ouvrir **pgAdmin 4** (installé avec PostgreSQL)

2. Se connecter avec le mot de passe défini

3. Créer la base :
   - Clic droit sur "Databases" → "Create" → "Database..."
   - Nom : **pieuvre_db**
   - Owner : **postgres**
   - Encoding : **UTF8**

Ou en ligne de commande :
```cmd
psql -U postgres
CREATE DATABASE pieuvre_db;
\q
```

### Étape 3 : Importer le schéma

1. Copier le fichier `schema.sql` sur le serveur

2. Exécuter :
   ```cmd
   cd chemin\vers\pieuvre-database
   psql -U postgres -d pieuvre_db -f schema.sql
   ```

3. Vérifier :
   ```cmd
   psql -U postgres -d pieuvre_db -c "SELECT COUNT(*) FROM clients;"
   ```
   Devrait retourner : 4 (clients de test)

### Étape 4 : Installer Node.js

1. Télécharger Node.js LTS :
   ```
   https://nodejs.org/
   ```

2. Installer avec les options par défaut

3. Vérifier :
   ```cmd
   node --version
   npm --version
   ```

### Étape 5 : Installer et configurer l'API

1. Copier le dossier `pieuvre-api` sur le serveur
   ```
   Exemple : C:\PieuvreAuto\pieuvre-api
   ```

2. Créer le fichier `.env` depuis `.env.example` :
   ```cmd
   cd C:\PieuvreAuto\pieuvre-api
   copy .env.example .env
   ```

3. Éditer `.env` avec vos paramètres :
   ```env
   PORT=3001
   WEB_URL=http://localhost:3000
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=pieuvre_db
   DB_PASSWORD=votre_mot_de_passe
   DB_PORT=5432
   NODE_ENV=production
   ```

4. Installer les dépendances :
   ```cmd
   npm install
   ```

5. Tester :
   ```cmd
   npm start
   ```
   
   Vous devriez voir :
   ```
   ═══════════════════════════════════════════════
   🚀 PIEUVRE API - Serveur démarré
   ═══════════════════════════════════════════════
   📡 Port: 3001
   🌐 URL: http://localhost:3001
   ```

6. Dans un autre terminal, tester :
   ```cmd
   curl http://localhost:3001/health
   ```

### Étape 6 : Installer l'interface web

1. Copier le dossier `pieuvre-web` sur le serveur

2. Créer `.env.local` :
   ```cmd
   cd C:\PieuvreAuto\pieuvre-web
   copy .env.local.example .env.local
   ```

3. Éditer `.env.local` :
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. Installer et compiler :
   ```cmd
   npm install
   npm run build
   ```

5. Démarrer :
   ```cmd
   npm start
   ```

6. Tester dans un navigateur :
   ```
   http://localhost:3000
   ```

### Étape 7 : Configurer comme service Windows

#### Pour l'API :

1. Installer `node-windows` :
   ```cmd
   npm install -g node-windows
   ```

2. Créer `install-service-api.js` :
   ```javascript
   var Service = require('node-windows').Service;
   
   var svc = new Service({
     name: 'Pieuvre API',
     description: 'Backend API pour Pieuvre Auto',
     script: 'C:\\PieuvreAuto\\pieuvre-api\\server.js',
     env: {
       name: "NODE_ENV",
       value: "production"
     }
   });
   
   svc.on('install', function(){
     svc.start();
   });
   
   svc.install();
   ```

3. Exécuter :
   ```cmd
   node install-service-api.js
   ```

#### Pour l'interface Web :

Même procédure avec `install-service-web.js`

### Étape 8 : Configuration réseau

1. Trouver l'IP du serveur :
   ```cmd
   ipconfig
   ```
   Exemple : `192.168.1.50`

2. Ouvrir le pare-feu Windows :
   - Panneau de configuration → Pare-feu Windows
   - "Paramètres avancés"
   - "Règles de trafic entrant" → "Nouvelle règle"
   - Type : Port
   - TCP : **3000, 3001**
   - Autoriser la connexion
   - Nom : "Pieuvre Auto"

3. Mettre une IP fixe :
   - Panneau de configuration → Centre Réseau
   - Modifier les paramètres de la carte
   - Propriétés IPv4
   - Utiliser l'adresse IP suivante : `192.168.1.50`

4. Tester depuis un autre PC :
   ```
   http://192.168.1.50:3000
   ```

---

## 🐧 INSTALLATION LINUX (Ubuntu 22.04)

### Étape 1 : Mettre à jour le système

```bash
sudo apt update
sudo apt upgrade -y
```

### Étape 2 : Installer PostgreSQL

```bash
sudo apt install postgresql-16 postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

Configurer le mot de passe postgres :
```bash
sudo -u postgres psql
ALTER USER postgres PASSWORD 'votre_mot_de_passe';
\q
```

### Étape 3 : Créer la base de données

```bash
sudo -u postgres createdb pieuvre_db
sudo -u postgres psql -d pieuvre_db -f /chemin/vers/pieuvre-database/schema.sql
```

### Étape 4 : Installer Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

### Étape 5 : Installer l'API

```bash
cd /opt
sudo mkdir pieuvre
cd pieuvre
sudo cp -r /chemin/source/pieuvre-api .
cd pieuvre-api
sudo cp .env.example .env
sudo nano .env  # Éditer avec vos paramètres
sudo npm install
```

### Étape 6 : Créer un service systemd pour l'API

```bash
sudo nano /etc/systemd/system/pieuvre-api.service
```

Contenu :
```ini
[Unit]
Description=Pieuvre API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pieuvre/pieuvre-api
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

Activer :
```bash
sudo systemctl daemon-reload
sudo systemctl enable pieuvre-api
sudo systemctl start pieuvre-api
sudo systemctl status pieuvre-api
```

### Étape 7 : Installer l'interface web

```bash
cd /opt/pieuvre
sudo cp -r /chemin/source/pieuvre-web .
cd pieuvre-web
sudo cp .env.local.example .env.local
sudo nano .env.local
sudo npm install
sudo npm run build
```

Créer le service :
```bash
sudo nano /etc/systemd/system/pieuvre-web.service
```

Contenu :
```ini
[Unit]
Description=Pieuvre Web Interface
After=network.target pieuvre-api.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/pieuvre/pieuvre-web
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Activer :
```bash
sudo systemctl enable pieuvre-web
sudo systemctl start pieuvre-web
```

### Étape 8 : Configuration réseau

```bash
# Ouvrir les ports
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw enable

# Trouver l'IP
ip addr show
```

---

## ✅ VÉRIFICATION DE L'INSTALLATION

### Tests à effectuer :

1. **Base de données** :
   ```bash
   psql -U postgres -d pieuvre_db -c "SELECT COUNT(*) FROM clients;"
   ```
   Résultat attendu : 4

2. **API** :
   ```bash
   curl http://localhost:3001/health
   ```
   Résultat attendu : `{"status":"OK", ...}`

3. **Interface web** :
   Ouvrir dans un navigateur :
   ```
   http://localhost:3000
   ```
   Devrait afficher le dashboard

4. **Depuis un autre PC** :
   ```
   http://IP_SERVEUR:3000
   ```

---

## 🔒 SÉCURITÉ

### Recommandations :

1. **Changer les mots de passe par défaut**
   - PostgreSQL : mot de passe fort
   - Ajouter authentification API si nécessaire

2. **Firewall** :
   - Limiter l'accès aux ports 3000/3001 au réseau local uniquement

3. **Sauvegardes** :
   - Configurer des sauvegardes automatiques de PostgreSQL
   ```bash
   # Exemple cron quotidien
   0 2 * * * pg_dump -U postgres pieuvre_db > /backup/pieuvre_$(date +\%Y\%m\%d).sql
   ```

4. **Mises à jour** :
   - Garder Node.js et PostgreSQL à jour

---

## 🐛 DÉPANNAGE

### L'API ne démarre pas

```bash
# Vérifier les logs
journalctl -u pieuvre-api -n 50

# Vérifier PostgreSQL
systemctl status postgresql

# Tester la connexion DB
psql -U postgres -d pieuvre_db
```

### L'interface web ne se charge pas

```bash
# Vérifier les logs
journalctl -u pieuvre-web -n 50

# Vérifier que l'API est accessible
curl http://localhost:3001/health
```

### Erreur de connexion réseau

```bash
# Vérifier les ports
netstat -tulpn | grep -E '3000|3001'

# Vérifier le firewall
sudo ufw status
```

---

## 📞 SUPPORT

En cas de problème, consulter :
- README.md principal
- Logs de l'application
- Documentation PostgreSQL
- Documentation Node.js

---

**Installation réalisée avec succès !** 🎉

Passez maintenant au **GUIDE_INSTALLATION_CLIENTS.md** pour installer le plugin sur les postes AutoCAD.
