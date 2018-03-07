const bcrypt = require('bcrypt');
const database = require('better-sqlite3');
const fs = require('fs');

const dbName = 'passwords.sqlite3';

module.exports = {
    addPassword: (filePath, password) => {
        let db = new database(dbName);
        db.prepare('INSERT INTO passwords (file_path, password_hash) VALUES (?, ?)').run(filePath, bcrypt.hashSync(password, 10));
        db.close();
    },

    removePassword: (filePath) => {
        let db = new database(dbName);
        db.prepare('delete from passwords where file_path = ?').run(filePath);
        db.close();
    },

    checkPassword: (filePath, password) => {
        let db = new database(dbName);
        let row = db.prepare('select * from passwords where file_path = ?').get(filePath);
        db.close();
        return bcrypt.compareSync(password, row.password_hash);
    },

    recreateDatabase: () => {
        fs.unlink(dbName, (error) => {
            if (error && error.code != 'ENOENT') {
                throw error;
            }

            let db = new database(dbName);
            db.prepare('CREATE TABLE passwords (file_path text NOT NULL, password_hash text NOT NULL);').run();
            db.close();
        });
    }
};
