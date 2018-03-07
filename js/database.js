/**
 * @author James Lee
 * A simple module which facilitate the management of a path/password database.
 */

const bcrypt = require('bcrypt');
const database = require('better-sqlite3');
const fs = require('fs');

const dbName = 'passwords.sqlite3';

module.exports = {
    /**
     * @name addPassword
     * @description Add a filePath/password entry to the database. Called when the user uploads a file to the server.
     * @param {string} filePath - Path to file on the server
     * @param {string} password - The users password
     */
    addPassword: (filePath, password) => {
        let db = new database(dbName);
        db.prepare('INSERT INTO passwords (file_path, password_hash) VALUES (?, ?)').run(filePath, bcrypt.hashSync(password, 10));
        db.close();
    },

    /**
     * @name removePassword
     * @description Removes a password from the database. Called when the user has claimed the download.
     * @param {string} filePath - Path to file on the server.
     */
    removePassword: (filePath) => {
        let db = new database(dbName);
        db.prepare('delete from passwords where file_path = ?').run(filePath);
        db.close();
    },

    /**
     * @name checkPassword
     * @description Check the users password with the password in the database. Used to grant access to the file on the server.
     * @param {string} filePath - Path to file on the server.
     * @param {string} password - The users password.
     */
    checkPassword: (filePath, password) => {
        let db = new database(dbName);
        let row = db.prepare('select * from passwords where file_path = ?').get(filePath);
        db.close();
        return bcrypt.compareSync(password, row.password_hash);
    },

    /**
     * @name recreateDatabase
     * @description Used to remove then recreate the password database.
     */
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
