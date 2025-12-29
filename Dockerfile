FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root
WORKDIR /usr/src/app

# Копіюємо файли конфігурації пакетів
COPY package*.json ./

# Встановлюємо залежності (без dev-залежностей для економії місця)
RUN npm ci --omit=dev

# Копіюємо весь код проєкту
COPY . .

# Створюємо папку для бази даних і надаємо права користувачу pptruser
RUN mkdir -p /usr/src/app/data && chown -R pptruser:pptruser /usr/src/app/data

# Перемикаємося на безпечного користувача (вимога Puppeteer)
USER pptruser

# Змінні середовища
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PORT=3000

EXPOSE 3000

# Запускаємо сервер
CMD ["node", "server.js"]