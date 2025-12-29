# Використовуємо нову версію
FROM ghcr.io/puppeteer/puppeteer:24.1.0

USER root
WORKDIR /usr/src/app

# 1. Копіюємо все
COPY . .

# 2. Видаляємо сміття (node_modules з Fedora)
RUN rm -rf node_modules package-lock.json

# 3. Копіюємо package.json
COPY package.json ./

# 4. Ставимо залежності
RUN npm install --omit=dev

# 5. Лагодимо базу даних
RUN npm rebuild better-sqlite3

# 6. Права доступу
RUN mkdir -p /usr/src/app/data && chown -R pptruser:pptruser /usr/src/app/data

USER pptruser

# 🔥 ВИПРАВЛЕННЯ: Ми прибрали PUPPETEER_EXECUTABLE_PATH.
# Тепер Puppeteer сам знайде правильний браузер всередині контейнера.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PORT=3000

CMD ["node", "server.js"]