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

/**
 * @name serveStaticFiles
 * @description Automatically serves static files in the given directory.
 * @param {string} staticPageDir
 */
async function serveStaticFiles(staticPageDir) {
	await new Promise((resolve) => {
		fs.readdirSync(staticPageDir).map(file => {
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
}

/**
 * @name cleanupUnclaimed
 * @description Remove any storage directories from the last time that the server was run.
 * @param {string} storageDir Directory to search in.
 * @param {string} prefix Prefix for the storage files {default: storage-}.
 */
async function cleanupUnclaimed() {
	await new Promise((resolve, reject) => {
		fs.readdirSync(storageDir).map(folder => {
			if (folder.split('-').shift() === prefix) {
				const stats = fs.statSync(path.join(storageDir, folder))
				const timeNow = new Date().getTime()
				const fileTime = new Date(stats.ctime).getTime() + maxAge

				if (timeNow > fileTime) {
					rimraf(path.join(storageDir, folder), (error) => {
						if (error) {
							reject(error)
						}
					})

					let id = folder.split('-')
					id.shift()
					id = id.join('-')

					const routes = ['/' + id, '/share/' + id, '/download/' + id]

					routes.map(route => {
						routeRemover.removeRouteByPath(app, route)
					})

					const files = fs.readdirSync(path.join(storageDir, folder))

					if (files.length > 0) {
						files.map(file => {
							database.removeRow(file)
						})
					}

					resolve()
				}
			}
		})
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
		if (database.checkPassword(filePath, req.body.password)) {
			// TODO - Email the user when the file has been downloaded

			encryptor.decryptFile(filePath + '.data', filePath, req.body.password, (error) => {
				if (error) {
					throw error
				}

				res.download(filePath)

				database.removeRow(filePath)

				const routes = [`/download/${id}`, `/share/${id}`]

				routes.map(route => {
					routeRemover.removeRouteByPath(app, route, (error) => {
						if (error) {
							throw error
						}
					})
				})

				rimraf(path.dirname(filePath), (error) => {
					if (error) {
						throw error
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
app.post('/upload', (req, res) => {
	const id = uuid()
	const fileDir = path.join(storageDir, prefix + '-') + id
	const file = req.files.file
	const password = req.body.password
	const email = req.body.email.length > 0 ? req.body.email : null
	const filePath = path.join(fileDir, file.name)
	const saltRounds = 10

	fs.mkdir(fileDir, (error) => {
		if (error) {
			throw error
		}
	})

	file.mv(filePath, (error) => {
		if (error) {
			throw error
		}

		encryptor.encryptFile(filePath, filePath + '.data', password, (error) => {
			if (error) {
				throw error
			}

			fs.unlink(filePath, (error) => {
				if (error) {
					throw error
				}
			})
		})
	})

	database.addRow(email, password, filePath, saltRounds)
	addTempRoutes(id, filePath)
	res.redirect('/share/' + id)
})

const port = 8080
const prefix = 'storage'
const storageDir = '/tmp/'
const maxAge = 3600000

app.listen(port, () => {
	database.recreateDatabase()

	schedule.scheduleJob('0 * * * *', () => {
		cleanupUnclaimed()
	})

	serveStaticFiles(path.join(__dirname, 'pages', 'static'))
})
