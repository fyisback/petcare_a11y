FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root
WORKDIR /usr/src/app

# Копіюємо конфіги і ставимо залежності
COPY package*.json ./
RUN npm ci --omit=dev

# Копіюємо решту файлів (включаючи потенційно "погані" node_modules з твого ПК)
COPY . .

# 🔥 ГОЛОВНЕ ВИПРАВЛЕННЯ:
# Примусово перекомпілюємо better-sqlite3 під систему Render
RUN npm rebuild better-sqlite3

# Налаштовуємо права доступу
RUN mkdir -p /usr/src/app/data && chown -R pptruser:pptruser /usr/src/app/data

USER pptruser

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PORT=3000

CMD ["node", "server.js"]