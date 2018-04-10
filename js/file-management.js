#!/usr/bin/node

/**
 * @author James Lee
 * A simple module which facilitates the management of a path/password database.
 */

/**
 * @module File Management
 */

'use strict'

const database = require('./database.js')
const encryptor = require('file-encryptor')
const fs = require('fs')
const notify = require('./notify.js')
const path = require('path').posix
const QRCode = require('qrcode')
const rimraf = require('rimraf')
const routeRemover = require('./express-route-remover.js')
const uuid = require('uuid/v1')

const status = {
	'unauthorized': 401
}

module.exports = {
	restoreRoutes: (app) => {
		database.getAllRoutes((error, rows) => {
			if (error) {
				console.error(error)
			}

			rows.map(row => {
				const filePath = row.file_path
				let id = path.basename(path.dirname(filePath))
				id = id.split('-')
				id.shift()
				id = id.join('-')
				module.exports.addTempRoutes(app, id, filePath)
			})
		})
	},

	/**
	 * @name uploadFile
	 * @route {post} /upload
	 * @description The link at which the user uploads the file that they want to share.
	 * @bodyparam {express-fileupload} file - File uploaded by the user.
	 * @bodyparam {string} password - Password uploaded by the user.
	 */
	acceptUploads: (app, storageDir, prefix) => {
		app.post('/upload', async(req, res) => {
			try {
				await new Promise((resolve, reject) => {
					const id = uuid()
					const fileDir = path.join(storageDir, prefix + '-') + id
					const email = req.body.email.length > 0 ? req.body.email : null
					const filePath = path.join(fileDir, req.files.file.name)

					fs.mkdir(fileDir, (error) => {
						if (error) {
							return reject(error)
						}
					})

					req.files.file.mv(filePath, (error) => {
						if (error) {
							return reject(error)
						}

						encryptor.encryptFile(filePath, filePath + '.data', req.body.password, (error) => {
							if (error) {
								return reject(error)
							}

							res.redirect('/share/' + id)

							fs.unlink(filePath, (error) => {
								if (error) {
									return reject(error)
								}
							})

							resolve()
						})
					})

					database.addRow(email, req.body.password, filePath)
					module.exports.addTempRoutes(app, id, filePath)
				})
			} catch(error) {
				console.error(error)
			}
		})
	},

	/**
	 * @description Creates the temporary routes which are relevent to accessing and sharing a file.
	 * @param {string} id - The id as reference for the current file {Used to maintain concurrency}.
	 * @param {string} filePath - The path to the file stored on the server.
	 */
	addTempRoutes: (app, id, filePath) => {
		/**
		 * @name sharePage
		 * @route {get} /share/{id}
		 */
		app.get('/share/' + id, async(req, res) => {
			await new Promise((resolve, reject) => {
				QRCode.toDataURL('localhost:8080/download/' + id, (error, url) => {
					if (error) {
						reject(error)
					}

					res.render(path.join('..', 'pages', 'dynamic', 'share.html'), {
						locals: {
							id: id,
							fileName: path.basename(filePath),
							qrcode: url
						}
					})
				})

				resolve()
			})
		})

		/**
		 * @name downloadPage
		 * @route {get} /download/{id}
		 */
		app.get('/download/' + id, async(req, res) => {
			await new Promise((resolve) => {
				res.render(path.join('..', 'pages', 'dynamic', 'download.html'), {
					locals: {
						id: id
					}
				})

				resolve()
			})
		})

		/**
		 * @name downloadFile
		 * @route {post} /download/{id}
		 * @bodyparam {string} password - The password used to allow access to the encrypted file.
		 */
		app.post('/download/' + id, async(req, res) => {
			try {
				await new Promise((resolve, reject) => {
					database.checkPassword(filePath, req.body.password, (error, result) => {
						if (error) {
							return reject(error)
						}

						if (!result) {
							return res.status(status.unauthorized).redirect('/download/' + id)
						}

						encryptor.decryptFile(filePath + '.data', filePath, req.body.password, (error) => {
							if (error) {
								return reject(error)
							}

							res.download(filePath)

							rimraf(path.dirname(filePath), (error) => {
								if (error) {
									return reject(error)
								}
							})
						})

						database.getEmail(filePath, (error, result) => {
							if (error) {
								console.error(error)
							}

							if (result !== '' && result !== null) {
								notify.notifyFileClaimed(result, path.basename(filePath))
							}
						})

						database.removeRow(filePath)

						const routes = [`/download/${id}`, `/share/${id}`]

						routes.map(route => {
							routeRemover.removeRouteByPath(app, route)
						})

						resolve()
					})
				})
			} catch(error) {
				console.error(error)
			}
		})
	}
}
