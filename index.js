#!/usr/bin/node

const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const database = require('./js/database.js');
const encryptor = require('file-encryptor');
const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const glob = require('glob');
const path = require('path').posix;
const rimraf = require('rimraf');
const schedule = require('node-schedule');
const uuid = require('uuid/v1');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

function removeTempUrl(routePath) {
    app._router.stack.map((route, index, routes) => {
        try {
            if (route.route.path == routePath) {
                routes.splice(index, 1);
            }
        } catch (Typeerr) {

        }
    });
}

function addTempUrl(id, filePath) {
    app.get('/share/' + id, (req, res) => {
        const $ = cheerio.load(fs.readFileSync(path.join('pages', 'share.html.noserv')));
        $('#download_url').text('/share/' + id);
        $('#download_link').attr('href', '/download/' + id);
        res.send($.html());
    });

    app.get('/download/' + id, (req, res) => {
        const $ = cheerio.load(fs.readFileSync(path.join('pages', 'download.html.noserv')));
        $('#download_form').attr('action', '/download/' + id);
        res.send($.html());
    });

    app.post('/download/' + id, (req, res) => {
        if (database.checkPassword(filePath, req.body.password)) {
            encryptor.decryptFile(filePath + '.data', filePath, req.body.password, (error) => {
                if (error) {
                    throw error;
                }

                res.download(filePath, (error) => {
                    if (error) {
                        throw error;
                    }
                });

                rimraf(path.dirname(filePath), (error) => {
                    if (error) {
                        throw error;
                    }
                });

                removeTempUrl('/share/' + id);
                removeTempUrl('/download/' + id);

                database.removePassword(filePath);
            });
        } else {
            res.redirect('/download/' + id);
        }
    });
}

fs.readdirSync(path.join(__dirname, 'pages')).map(page => {
    if (page.split('.').pop() === 'html') {
        if (page === 'index.html') {
            app.get('/', (req, res) => {
                res.sendFile(path.join(__dirname, 'pages', page));
            });
        } else {
            app.get(path.join('/', 'pages', page), (req, res) => {
                res.sendFile(path.join(__dirname, 'pages', page));
            });
        }
    }
});

app.post(path.join('/', 'upload'), (req, res) => {
    const id = uuid();
    const storageDir = path.join('/tmp/storage-') + id;

    const file = req.files.file;
    const password = req.body.password;

    const filePath = path.join(storageDir, file.name);

    fs.mkdir(storageDir, (error) => {
        if (error) {
            throw error;
        }
    });

    file.mv(filePath, (error) => {
        if (error) {
            throw error;
        }
    });

    encryptor.encryptFile(filePath, filePath + '.data', password, function(error) {
        if (error) {
            throw error;
        }

        fs.unlink(filePath, (error) => {
            if (error) {
                throw error;
            }
        });
    });

    database.addPassword(filePath, password);

    addTempUrl(id, filePath);

    res.redirect('/share/' + id);
});

schedule.scheduleJob('0 * * * *', () => {
    glob(path.posix.join('/tmp', 'storage-*'), (error, files) => {
        if (error) {
            throw error;
        }

        files.map(filePath => {
            fs.stat(filePath, (error, stats) => {
                if (error) {
                    throw error;
                }

                let timeNow = new Date().getTime();
                let fileTime = new Date(stats.ctime).getTime() + 3600000;

                if (timeNow > fileTime) {
                    rimraf(filePath, (error) => {
                        if (error) {
                            throw error;
                        }
                    });
                }

                let route = filePath.split('-');

                route.shift();
                route.shift();

                removeTempUrl('/' + route.join('-'));
            });
        });
    });
});

const port = 8080;

app.listen(port, () => {
    glob('/tmp/storage-*', (error, files) => {
        if (error) {
            throw error;
        }

        files.map(file => {
            rimraf(file, (error) => {
                if (error) {
                    throw error;
                }
            });
        });
    });

    database.recreateDatabase();

    console.log(`app listening on port ${port}`);
});
