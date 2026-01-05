const express = require('express');
const { exec } = require('child_process');
const app = express();

app.get('/', (req, res) => {
    // 1. Команда пошуку: шукаємо в /var і /opt файли .sqlite АБО .db
    // 2>/dev/null приховує помилки доступу до системних папок
    const command = 'find /var /opt -type f \\( -name "*.sqlite" -o -name "*.db" \\) 2>/dev/null';

    console.log("Running search...");

    exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        let html = `
            <style>body{font-family:sans-serif;padding:20px;line-height:1.6}</style>
            <h1>🔍 Результати пошуку БД</h1>
            <p>Шукаємо .sqlite та .db у папках /var та /opt...</p>
            <hr>
        `;

        if (error && !stdout) {
            html += `<h3 style="color:red">Помилка пошуку або нічого не знайдено:</h3><pre>${error.message}</pre>`;
        } else {
            const files = stdout.trim().split('\n').filter(line => line.length > 0);
            
            if (files.length === 0) {
                html += `<h3>☹️ Жодного файлу бази даних не знайдено.</h3>`;
                html += `<p>Перевірено шляхи: /var, /opt</p>`;
            } else {
                html += `<h3>🎉 Знайдено файлів: ${files.length}</h3><ul>`;
                files.forEach(filePath => {
                    // Кодуємо шлях, щоб передати його в URL
                    const encodedPath = encodeURIComponent(filePath);
                    html += `<li>
                        <strong>${filePath}</strong> <br>
                        <a href="/download?path=${encodedPath}" style="background:green;color:white;padding:5px 10px;text-decoration:none;border-radius:5px;">💾 СКАЧАТИ ЦЕЙ ФАЙЛ</a>
                    </li><br>`;
                });
                html += `</ul>`;
            }
        }
        
        // Додаємо інфо про диск для діагностики
        exec('df -h', (e, dfOut) => {
            html += `<hr><h3>Інформація про диски (Mounts):</h3><pre>${dfOut}</pre>`;
            res.send(html);
        });
    });
});

// Роут для скачування за повним шляхом
app.get('/download', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.send("No path provided");
    res.download(filePath);
});

app.listen(10000, () => console.log('Search & Rescue server running on 10000'));
