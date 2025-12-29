FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root
WORKDIR /usr/src/app

# 1. Копіюємо все
COPY . .

# 2. 🔥 ГОЛОВНЕ: Видаляємо "чужі" node_modules
RUN rm -rf node_modules package-lock.json

# 3. Копіюємо package.json окремо (щоб точно був)
COPY package.json ./

# 4. Ставимо чисті модулі
RUN npm install --omit=dev

# 5. Лагодимо базу даних
RUN npm rebuild better-sqlite3

# 6. Права доступу
RUN mkdir -p /usr/src/app/data && chown -R pptruser:pptruser /usr/src/app/data

USER pptruser

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PORT=3000

CMD ["node", "server.js"]