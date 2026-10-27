// Лабораторна робота 4 - Варіант 1
import http from 'http';
import fs from 'fs';
import { URL } from 'url';
import { Command } from 'commander';

const program = new Command();

// Збереження --help та усунення конфлікту з -h (для --host)
program.helpOption('--help', 'Показати довідку');
program.requiredOption('-i, --input <path>', 'шлях до файлу даних');
program.requiredOption('-h, --host <address>', 'адреса сервера');
program.requiredOption('-p, --port <number>', 'порт сервера');
program.option('-o, --output <path>', 'файл, у який записується остання надіслана відповідь');

program.parse(process.argv);
const options = program.opts();

// Перевірка наявності файлу (error-first callback)
fs.access(options.input, fs.constants.F_OK, (err) => {
    if (err) {
        console.error("Cannot find input file");
        process.exit(1);
    }
    startServer();
});

function startServer() {
    const server = http.createServer((req, res) => {
        const reqUrl = new URL(req.url, `http://${options.host}:${options.port}`);

        // Будь-який інший шлях повертає 404
        if (reqUrl.pathname !== '/') {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: "Маршрут не знайдено" }));
            return;
        }

        // Асинхронне читання файлу через callback API
        fs.readFile(options.input, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: "Помилка читання файлу" }));
                return;
            }

            let bankData;
            try {
                bankData = JSON.parse(data);
            } catch (parseErr) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: "Пошкоджений файл даних" }));
                return;
            }

            const showMfo = reqUrl.searchParams.get('mfo') === 'true';
            const onlyNormal = reqUrl.searchParams.get('normal') === 'true';

            const result = [];

            for (let i = 0; i < bankData.length; i++) {
                const record = bankData[i];
                const stateCode = Number(record.COD_STATE);

                // Фільтр ?normal=true: лише банки зі станом 1 ("Нормальний")
                if (onlyNormal && stateCode !== 1) {
                    continue;
                }

                const filteredRecord = {};

                // Поле mfo_code показуємо лише якщо mfo=true
                if (showMfo) {
                    const mfoVal = Number(record.MFO);
                    filteredRecord.mfo_code = isNaN(mfoVal) ? null : mfoVal;
                }

                // Поля name та state_code за вимогами варіанта
                filteredRecord.name = record.SHORTNAME || null;
                filteredRecord.state_code = isNaN(stateCode) ? null : stateCode;

                result.push(filteredRecord);
            }

            const jsonResponse = JSON.stringify(result, null, 2);

            // Асинхронний запис у файл, якщо передана опція -o
            if (options.output) {
                fs.writeFile(options.output, jsonResponse, 'utf8', (writeErr) => {
                    if (writeErr) {
                        console.error("Помилка запису у файл виводу:", writeErr);
                    }
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(jsonResponse);
        });
    });

    server.listen(options.port, options.host, () => {
        console.log(`🚀Сервер запущено на http://${options.host}:${options.port}`);
    });
}