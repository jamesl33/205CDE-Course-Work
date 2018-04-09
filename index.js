#!/usr/bin/node

/**
 * @author James Lee
 * A simple file sharing application with a focus on privacy.
 */

'use strict'

const bodyParser = require('body-parser')
const database = require('./js/database.js')
const encryptor = require('file-encryptor')
const es6Renderer = require('express-es6-template-engine')
const express = require('express')
const fileUpload = require('express-fileupload')
const fs = require('fs')
const garbageCollection = require('./js/garbage-collection.js')
const notify = require('./js/notify.js')
const path = require('path').posix
const QRCode = require('qrcode')
const rimraf = require('rimraf')
const routeRemover = require('./js/express-route-remover.js')
const schedule = require('node-schedule')
const uuid = require('uuid/v1')

const status = {
	'unauthorized': 401
}

const app = express()

app.engine('html', es6Renderer)
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, 'public')))
app.use(fileUpload())

app.set('view engine', 'html')

/**
 * @description Automatically serves static files in the given directory.
 * @param {string} staticFileDir - The directory which contains the static files to served
 */
async function serveStaticFiles(staticFileDir) {
	try {
		await new Promise((resolve, reject) => {
			fs.readdir(staticFileDir, (error, files) => {
				if (error) {
					return reject(error)
				}

				files.map(file => {
					if (file === 'index.html') {
						app.get('/', (req, res) => {
							res.sendFile(path.join(staticFileDir, file))
						})
					} else {
						app.get(path.join('/', file), (req, res) => {
							res.sendFile(path.join(staticFileDir, file))
						})
					}
				})

				resolve()
			})
		})
	} catch(error) {
		console.error(error)
	}
}

/**
 * @name uploadFile
 * @route {post} /upload
 * @description The link at which the user uploads the file that they want to share.
 * @bodyparam {express-fileupload} file - File uploaded by the user.
 * @bodyparam {string} password - Password uploaded by the user.
 */
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
			addTempRoutes(id, filePath)
		})
	} catch(error) {
		console.error(error)
	}
})

/**
 * @description Creates the temporary routes which are relevent to accessing and sharing a file.
 * @param {string} id - The id as reference for the current file {Used to maintain concurrency}.
 * @param {string} filePath - The path to the file stored on the server.
 */
function addTempRoutes(id, filePath) {
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


const port = 8080
const prefix = 'storage'
const storageDir = '/tmp/'
const maxAge = 3600000

app.listen(port, () => {
	database.recreateDatabase()

	schedule.scheduleJob('0 * * * * *', () => {
		garbageCollection.cleanupAllUnclaimed(app, storageDir, prefix, maxAge)
	})

	serveStaticFiles(path.join(__dirname, 'pages', 'static'))

	console.log(`app listening on port ${port}`)
})
