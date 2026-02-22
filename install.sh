# Installation
apt install -y nodejs npm git build-essential

# Créer l'utilisateur (sécurité)
useradd -m -s /bin/bash phantom
usermod -aG sudo phantom

# Passer à l'utilisateur
su - phantom

# Cloner/Créer le projet
mkdir /home/phantom/phantom-grabber
cd /home/phantom/phantom-grabber

# Créer les dossiers
mkdir -p modules public/templates public/assets data dashboard
Étape 2: Installation des dépendances
bash
npm init -y
npm install express ws axios dotenv node-telegram-bot-api ip useragent fs-extra crypto-js socket.io puppeteer express-rate-limit helmet compression
# En tant que root
ufw allow 3000
ufw allow 8080
ufw allow 443
ufw enable
# Installer Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir certificat
certbot certonly --standalone -d localhost

# Modifier server.js pour HTTPS

