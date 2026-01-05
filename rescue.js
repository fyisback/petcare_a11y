const express = require('express');
const app = express();

app.get('/', (req, res) => {
    const file = '/var/data/database.db'; // Ваш шлях
    res.download(file);
});

app.listen(10000, () => console.log('Rescue server running'));
