#!/usr/bin/node

/**
 * @author James Lee
 * A simple module which facilitates the management of a path/password database.
 * All of the database operations are sanitised therefore shouldn't be vulnerable to SQL injection.
 */

/**
 * @module Database
 */

'use strict'

const bcrypt = require('bcrypt')
const database = require('better-sqlite3')
const fs = require('fs')

const dbName = 'database.sqlite3'

const bcryptPreferences = {
	'saltRounds': 10
}

module.exports = {
	/**
	 * @description Get the email corresponding to a files path.
	 * @param {string} filePath - Path to file on the server.
	 * @param {function} callback - The function which the error/result is passed too.
	 * @returns {string} - An email address.
	 */
	getEmail: async(filePath, callback) => {
		try {
			const result = await new Promise((resolve) => {
				const db = new database(dbName)

				// Get row which corresponds to this filePath
				const row = db.prepare('select (email) from passwords where file_path = ?').get(filePath)
				db.close()
				resolve(row.email)
			})

			callback(null, result)
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @description Add a filePath/password entry to the database. Called when the user uploads a file to the server.
     * @param {string} email - The users email
     * @param {string} password - The users password.
	 * @param {string} filePath - Path to file on the server.
	 */
	addRow: async(email, password, filePath) => {
		try {
			await new Promise((resolve) => {
				const db = new database(dbName)

				// Add the user/file info into the database
				db.prepare('INSERT INTO passwords (email, password_hash, file_path) VALUES (?, ?, ?)').run(email, bcrypt.hashSync(password, bcryptPreferences.saltRounds), filePath)
				db.close()
				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @description Removes a password from the database. Called when the user has claimed the download.
	 * @param {string} filePath - Path to file on the server.
	 */
	removeRow: async(filePath) => {
		try {
			await new Promise((resolve) => {
				const db = new database(dbName)

				// Remove the row from the database which has this filePath
				db.prepare('delete from passwords where file_path = ?').run(filePath)
				db.close()
				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @description Check the users password with the password in the database. Used to grant access to the file on the server.
	 * @param {string} filePath - Path to file on the server.
	 * @param {string} password - The users password.
	 * @returns {bool} True if the password matches.
	 */
	checkPassword: async(filePath, password, callback) => {
		try {
			const result = await new Promise((resolve) => {
				const db = new database(dbName)

				// Get the row whose file_path is the one we are checking
				const row = db.prepare('select * from passwords where file_path = ?').get(filePath)
				db.close()

				// Use bcrypt to compare the passwords
				resolve(bcrypt.compareSync(password, row.password_hash))
			})

			callback(null, result)
		} catch(error) {
			callback(error)
		}
	},

	/**
	 * @description This function is used to get all the rows from the database. This function is used to recreate the express routes when the server is restarted.
	 * @param {function} callback - A callback function where which all the rows from the database are passed to.
	 */
	getAllRoutes: async(callback) => {
		try {
			const result = await new Promise((resolve) => {
				const db = new database(dbName)

				// Get everything from the database
				const rows = db.prepare('select * from passwords').all()
				db.close()
				resolve(rows)
			})

			callback(null, result)
		} catch(error) {
			callback(error)
		}
	},

	createDatabase: () => {
		if (fs.existsSync(dbName)) {
			return
		}

		const db = new database(dbName)
		db.prepare('CREATE TABLE passwords (email text, password_hash text NOT NULL, file_path text NOT NULL);').run()
		db.close()
	}
}
