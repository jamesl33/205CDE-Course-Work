#!/usr/bin/node

/**
 * @author James Lee
 * A simple module which facilitate the management of a path/password database.
 */

'use strict'

const bcrypt = require('bcrypt')
const database = require('better-sqlite3')
const fs = require('fs')

const dbName = 'passwords.sqlite3'

const bcryptPreferences = {
	'saltRounds': 10
}

module.exports = {
	/**
	 * @name getEmail
	 * @description Get the email corresponding to a files path.
	 * @param {string} filePath - Path to file on the server.
	 * @param {function} callback - The function which the error/result is passed too.
	 */
	getEmail: async(filePath, callback) => {
		try {
			const result = await new Promise((resolve) => {
				const db = new database(dbName)
				const row = db.prepare('select * from passwords where file_path = ?').get(filePath)
				db.close()
				resolve(row.email)
			})

			callback(null, result)
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @name addRow
	 * @description Add a filePath/password entry to the database. Called when the user uploads a file to the server.
     * @param {string} email - The users email
     * @param {string} password - The users password.
	 * @param {string} filePath - Path to file on the server.
	 */
	addRow: async(email, password, filePath) => {
		try {
			await new Promise((resolve) => {
				const db = new database(dbName)
				db.prepare('INSERT INTO passwords (email, password_hash, file_path) VALUES (?, ?, ?)').run(email, bcrypt.hashSync(password, bcryptPreferences.saltRounds), filePath)
				db.close()
				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @name removeRow
	 * @description Removes a password from the database. Called when the user has claimed the download.
	 * @param {string} filePath - Path to file on the server.
	 */
	removeRow: async(filePath) => {
		try {
			await new Promise((resolve) => {
				const db = new database(dbName)
				db.prepare('delete from passwords where file_path = ?').run(filePath)
				db.close()
				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @name checkPassword
	 * @description Check the users password with the password in the database. Used to grant access to the file on the server.
	 * @param {string} filePath - Path to file on the server.
	 * @param {string} password - The users password.
	 */
	checkPassword: async(filePath, password, callback) => {
		try {
			const result = await new Promise((resolve) => {
				const db = new database(dbName)
				const row = db.prepare('select * from passwords where file_path = ?').get(filePath)
				db.close()
				resolve(bcrypt.compareSync(password, row.password_hash))
			})

			callback(null, result)
		} catch(error) {
			callback(error)
		}
	},

	/**
	 * @name recreateDatabase
	 * @description Used to remove then recreate the password database.
	 */
	recreateDatabase: async() => {
		try {
			await new Promise((resolve, reject) => {
				fs.unlink(dbName, (error) => {
					if (error && error.code !== 'ENOENT') {
						return reject(new Error(error.message))
					}

					const db = new database(dbName)
					db.prepare('CREATE TABLE passwords (email text, password_hash text NOT NULL, file_path text NOT NULL);').run()
					db.close()
					resolve()
				})
			})
		} catch(error) {
			console.error(error)
		}
	}
}
