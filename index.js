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
const glob = require('glob')
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

/**
 * @name serveStaticFiles
 * @description Automatically serves static files in the given directory.
 * @param {string} directory
 */
function serveStaticFiles(directory) {
	fs.readdirSync(directory).map(page => {
		if (page === 'index.html') {
			app.get('/', (req, res) => {
				res.sendFile(path.join(directory, page))
			})
		} else {
			app.get(path.join('/', page), (req, res) => {
				res.sendFile(path.join(directory, page))
			})
		}
	})
}

/**
 * @name addTempRoutes
 * @description Creates the temporary routes which are relevent to accessing and sharing a file.
 */
function addTempRoutes(id, filePath) {
	app.get('/share/' + id, (req, res) => {
		res.render(path.join(__dirname, 'pages', 'dynamic', 'share.html'), {
			locals: {
				downloadUrl: `/download/${id}`
			}
		})
	})

	app.get('/download/' + id, (req, res) => {
		res.render(path.join(__dirname, 'pages', 'dynamic', 'download.html'), {
			locals: {
				downloadUrl: `/download/${id}`
			}
		})
	})

	app.post('/download/' + id, (req, res) => {
		const password = req.body.password

		if (database.checkPassword(filePath, password)) {
			// TODO - Email the user when the file has been downloaded

			encryptor.decryptFile(filePath + '.data', filePath, password, (error) => {
				if (error) {
					console.error(error)
				}

				res.download(filePath)
				database.removeRow(filePath)
				routeRemover.removeRouteByPath(app, '/download/' + id)
				routeRemover.removeRouteByPath(app, '/share/' + id)

				rimraf(path.dirname(filePath), (error) => {
					if (error) {
						console.error(error)
					}
				})
			})
		} else {
			res.redirect('/download/' + id)
		}
	})
}

/**
 * @name /upload
 * @description The link from which the user uploads the file that they want to share.
 * @param {express-fileupload} file
 * @param {string} password
 */
app.post(path.join('/', 'upload'), (req, res) => {
	const id = uuid()
	const storageDir = path.join('/tmp/storage-') + id
	const file = req.files.file
	const password = req.body.password
	const email = req.body.email.length > 0 ? req.body.email : null
	const filePath = path.join(storageDir, file.name)
	const saltRounds = 10

	fs.mkdir(storageDir, (error) => {
		if (error) {
			console.error(error)
		}
	})

	file.mv(filePath, (error) => {
		if (error) {
			console.error(error)
		}

		encryptor.encryptFile(filePath, filePath + '.data', password, (error) => {
			if (!error) {
				fs.unlink(filePath, (error) => {
					if (error) {
						console.error(error)
					}
				})
			}
		})
	})

	database.addRow(email, password, filePath, saltRounds)
	addTempRoutes(id, filePath)
	res.redirect('/share/' + id)
})

/**
 * @name cleanupStorageDir
 * @description Remove any storage directories from the last time that the server was run.
 * @param {string} storageDir Directory to search in.
 * @param {string} prefix Prefix for the storage files {default: storage-}.
 */
function cleanupStorageDir(storageDir, prefix) {
	glob(`${path.join(storageDir, prefix)}*`, (error, files) => {
		if (error) {
			console.error(error)
		}

		files.map(file => {
			rimraf(file, (error) => {
				if (error) {
					console.error(error)
				}
			})
		})
	})
}

/**
 * @name startGarbageCollector
 * @description Start the scheduled job which cleans up downloads which have been unclaimed for a set amount of time.
 * @param {string} storageDir Directory to search in.
 * @param {string} prefix Prefix for the storage files {default: storage-}.
 * @param {int} maxAge Longest amount of time a file can be hosted {default: hour}.
 */
function startGarbageCollector(storageDir, prefix, maxAge) {
	schedule.scheduleJob('0 * * * *', () => {
		glob(`${path.posix.join(storageDir, prefix)}*`, (error, files) => {
			if (error) {
				console.error(error)
			}

			files.map(filePath => {
				fs.stat(filePath, (error, stats) => {
					if (error) {
						console.error(error)
					}

					const timeNow = new Date().getTime()
					const fileTime = new Date(stats.ctime).getTime() + maxAge

					if (timeNow > fileTime) {
						rimraf(filePath, (error) => {
							if (error) {
								console.error(error)
							}
						})
					}

					const route = filePath.split('-')

					route.shift()
					route.shift()

					routeRemover.removeRouteByPath(app, '/' + route.join('-'))

					fs.readdirSync(filePath).map(file => {
						database.removeRow(file)
					})
				})
			})
		})
	})
}

const maxAge = 3600000
const port = 8080
const prefix = 'storage-'
const storageDir = '/tmp/'

app.listen(port, () => {
	cleanupStorageDir(storageDir, prefix)
	startGarbageCollector(storageDir, prefix, maxAge)
	database.recreateDatabase()
	serveStaticFiles(path.join(__dirname, 'pages', 'static'))
	console.log(`app listening on port ${port}`)
})
