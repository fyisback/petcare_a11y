const express = require('express');
const app = express();
const fs = require('fs');

// Вкажіть тут ваш шлях до диска (той, що в Settings -> Disks -> Mount Path)
// Зазвичай це /var/data або /opt/render/project/data
const DB_PATH = '/var/data/database.db'; 

app.get('/', (req, res) => {
    if (fs.existsSync(DB_PATH)) {
        res.download(DB_PATH, 'saved_database.db');
    } else {
        res.send(`Файл не знайдено за шляхом: ${DB_PATH}. <br> Перевірте Mount Path.`);
    }
});

app.listen(10000, () => {
    console.log('Rescue server running on port 10000');
});
