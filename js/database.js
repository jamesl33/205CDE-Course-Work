/**
 * @author James Lee
 * A simple module which facilitate the management of a path/password database.
 */

'use strict'

const bcrypt = require('bcrypt')
const database = require('better-sqlite3')
const fs = require('fs')

const dbName = 'passwords.sqlite3'

module.exports = {
	/**
	 * @name addRow
	 * @description Add a filePath/password entry to the database. Called when the user uploads a file to the server.
     * @param {string} email - The users email
     * @param {string} password - The users password.
	 * @param {string} filePath - Path to file on the server.
     * @param {int} saltRounds - The salt round argument for bcrypt
	 */
	addRow: (email, password, filePath, saltRounds) => {
		const db = new database(dbName)
		db.prepare('INSERT INTO passwords (email, password_hash, file_path) VALUES (?, ?, ?)').run(email, bcrypt.hashSync(password, saltRounds), filePath)
		db.close()
	},

	/**
	 * @name removeRow
	 * @description Removes a password from the database. Called when the user has claimed the download.
	 * @param {string} filePath - Path to file on the server.
	 */
	removeRow: (filePath) => {
		const db = new database(dbName)
		db.prepare('delete from passwords where file_path = ?').run(filePath)
		db.close()
	},

	/**
	 * @name checkPassword
	 * @description Check the users password with the password in the database. Used to grant access to the file on the server.
	 * @param {string} filePath - Path to file on the server.
	 * @param {string} password - The users password.
	 */
	checkPassword: (filePath, password) => {
		const db = new database(dbName)
		const row = db.prepare('select * from passwords where file_path = ?').get(filePath)
		db.close()
		return bcrypt.compareSync(password, row.password_hash)
	},

	/**
	 * @name recreateDatabase
	 * @description Used to remove then recreate the password database.
	 */
	recreateDatabase: () => {
		fs.unlink(dbName, (error) => {
			if (error && error.code !== 'ENOENT') {
				console.error(error)
			}

			const db = new database(dbName)
			db.prepare('CREATE TABLE passwords (email text, password_hash text NOT NULL, file_path text NOT NULL);').run()
			db.close()
		})
	}
}
