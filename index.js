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
const path = require('path').posix
const rimraf = require('rimraf')
const routeRemover = require('./js/express-route-remover.js')
const schedule = require('node-schedule')
const uuid = require('uuid/v1')

const app = express()

app.engine('html', es6Renderer)
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static(path.join(__dirname, 'public')))
app.use(fileUpload())

app.set('view engine', 'html')

const status = {
	'unauthorized': 401
}

/**
 * @name serveStaticFiles
 * @description Automatically serves static files in the given directory.
 * @param {string} staticPageDir
 */
async function serveStaticFiles(staticPageDir, callback) {
	try {
		await new Promise((resolve, reject) => {
			fs.readdir(staticPageDir, (error, files) => {
				if (error) {
					return reject(new Error(error.message))
				}

				files.map(file => {
					if (file === 'index.html') {
						app.get('/', (req, res) => {
							res.sendFile(path.join(staticPageDir, file))
						})
					} else {
						app.get(path.join('/', file), (req, res) => {
							res.sendFile(path.join(staticPageDir, file))
						})
					}
				})

				resolve()
			})
		})
	} catch(error) {
		callback(new Error(error.message))
	}
}

/**
 * @name removeUnclaimedFolder
 * @description Remove an unclamied folder
 * @param {string} name of folder to be removed
 */
async function removeUnclaimedFolder(folder, callback) {
	try {
		await new Promise((resolve, reject) => {
			let id = folder.split('-')
			id.shift()
			id = id.join('-')

			const routes = ['/' + id, '/share/' + id, '/download/' + id]

			routes.map(route => {
				routeRemover.removeRouteByPath(app, route)
			})

			fs.readdir(path.join(storageDir, folder), (error, files) => {
				if (error) {
					return reject(new Error(error.message))
				}

				files.map(file => {
					database.removeRow(file, (error) => {
						if (error) {
							console.error(new Error(error.message))
						}
					})
				})
			})

			rimraf(path.join(storageDir, folder), (error) => {
				if (error) {
					return reject(new Error(error.message))
				}
			})
		})
	} catch(error) {
		callback(new Error(error.message))
	}
}

/**
 * @name cleanupAllUnclaimed
 * @description Remove any storage directories from the last time that the server was run.
 * @param {string} storageDir Directory to search in.
 * @param {string} prefix Prefix for the storage files {default: storage-}.
 */
async function cleanupAllUnclaimed(callback) {
	try {
		await new Promise((resolve, reject) => {
			fs.readdir(storageDir, (error, files) => {
				if (error) {
					return reject(new Error(error.message))
				}

				files.map(folder => {
					if (folder.split('-').shift() === prefix) {
						fs.stat(path.join(storageDir, folder), (error, stats) => {
							if (error) {
								return reject(new Error(error.message))
							}

							const timeNow = new Date().getTime()
							const fileTime = new Date(stats.ctime).getTime() + maxAge

							if (timeNow > fileTime) {
								removeUnclaimedFolder(folder)
								resolve()
							}
						})
					}
				})
			})
		})
	} catch(error) {
		callback(new Error(error.message))
	}
}

/**
 * @name addTempRoutes
 * @description Creates the temporary routes which are relevent to accessing and sharing a file.
 */
function addTempRoutes(id, filePath) {
	app.get('/share/' + id, async(req, res) => {
		await new Promise((resolve) => {
			res.render(path.join(__dirname, 'pages', 'dynamic', 'share.html'), {
				locals: {
					downloadUrl: `/download/${id}`
				}
			})

			resolve()
		})
	})

	app.get('/download/' + id, async(req, res) => {
		await new Promise((resolve) => {
			res.render(path.join(__dirname, 'pages', 'dynamic', 'download.html'), {
				locals: {
					downloadUrl: `/download/${id}`
				}
			})

			resolve()
		})
	})

	app.post('/download/' + id, async(req, res) => {
		try {
			await new Promise((resolve, reject) => {
				database.checkPassword(filePath, req.body.password, (error, result) => {
					if (error) {
						reject(new Error(error.message))
					}

					if (result) {
						encryptor.decryptFile(filePath + '.data', filePath, req.body.password, (error) => {
							if (error) {
								reject(new Error(error.message))
							}

							res.download(filePath)

							database.removeRow(filePath)

							const routes = [`/download/${id}`, `/share/${id}`]

							routes.map(route => {
								routeRemover.removeRouteByPath(app, route, (error) => {
									if (error) {
										reject(new Error(error.message))
									}
								})
							})

							rimraf(path.dirname(filePath), (error) => {
								if (error) {
									reject(new Error(error.message))
								}
							})
						})
					} else {
						return reject(new Error('Password Incorrect'))
					}
				})
			})
		} catch(error) {
			if (error.message === 'Password Incorrect') {
				res.status(status.unauthorized).send('Permission Denied')
			} else {
				console.error(new Error(error.message))
			}
		}
	})
}

/**
 * @name /upload
 * @description The link from which the user uploads the file that they want to share.
 * @param {express-fileupload} file
 * @param {string} password
 */

app.post('/upload', async(req, res) => {
	try {
		await new Promise((resolve, reject) => {
			const id = uuid()
			const fileDir = path.join(storageDir, prefix + '-') + id
			const file = req.files.file
			const password = req.body.password
			const email = req.body.email.length > 0 ? req.body.email : null
			const filePath = path.join(fileDir, file.name)
			const saltRounds = 10

			fs.mkdir(fileDir, (error) => {
				if (error) {
					return reject(new Error(error.message))
				}
			})

			file.mv(filePath, (error) => {
				if (error) {
					return reject(new Error(error.message))
				}

				encryptor.encryptFile(filePath, filePath + '.data', password, (error) => {
					if (error) {
						return reject(new Error(error.message))
					}

					fs.unlink(filePath, (error) => {
						if (error) {
							return reject(new Error(error.message))
						}
					})
				})
			})

			database.addRow(email, password, filePath, saltRounds, (error) => {
				if (error) {
					return reject(new Error(error.message))
				}
			})

			addTempRoutes(id, filePath)

			res.redirect('/share/' + id)
			resolve()
		})
	} catch(error) {
		console.error(new Error(error.message))
	}
})

const port = 8080
const prefix = 'storage'
const storageDir = '/tmp/'
const maxAge = 3600000

app.listen(port, () => {
	database.recreateDatabase((error) => {
		if (error) {
			console.error(new Error(error.message))
		}
	})

	schedule.scheduleJob('0 * * * *', () => {
		cleanupAllUnclaimed((error) => {
			if (error) {
				console.error(new Error(error.message))
			}
		})
	})

	serveStaticFiles(path.join(__dirname, 'pages', 'static'), (error) => {
		if (error) {
			console.error(new Error(error.message))
		}
	})

	console.log(`app listening on port ${port}`)
})
