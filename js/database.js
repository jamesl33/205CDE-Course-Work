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
const uuid = require('uuid/v1')

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
				const email = db.prepare('SELECT (email) FROM passwords JOIN users USING (id) WHERE file_path = ?').get(filePath).email
				db.close()
				resolve(email)
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
				const id = uuid()

				// Add the transaction id and user email to the database
				db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email)

				// Add the user/file info into the database
				db.prepare('INSERT INTO passwords (id, password_hash, file_path) VALUES (?, ?, ?)').run(id, bcrypt.hashSync(password, bcryptPreferences.saltRounds), filePath)

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
				const id = db.prepare('SELECT (id) FROM passwords WHERE file_path = ?').get(filePath).id

				// Remove row from passwords table to satisfy the foreign key constraint
				db.prepare('DELETE from passwords WHERE id = ?').run(id)

				// Remove the row from the users table
				db.prepare('DELETE from users WHERE id = ?').run(id)

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
				const hash = db.prepare('SELECT (password_hash) FROM passwords WHERE file_path = ?').get(filePath).password_hash
				db.close()
				resolve(bcrypt.compareSync(password, hash))
			})

			callback(null, result)
		} catch(error) {
			callback(error)
		}
	},

	/**
	 * @description This function is used to get all the relevent data from the database needed to recreate the Express routes.
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
		db.prepare('CREATE TABLE users (id text PRIMARY KEY NOT NULL, email text)').run()
		db.prepare('CREATE TABLE passwords (id text NOT NULL, password_hash text NOT NULL, file_path text NOT NULL, FOREIGN KEY(id) REFERENCES users(id));').run()
		db.close()
	}
}
