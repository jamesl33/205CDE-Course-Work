#!/usr/bin/node

/**
 * @author James Lee
 * A simple file sharing application with a focus on privacy.
 */

'use strict'

const bodyParser = require('body-parser')
const es6Renderer = require('express-es6-template-engine')
const express = require('express')
const fileMangement = require('./js/file-management.js')
const fileUpload = require('express-fileupload')
const fs = require('fs')
const garbageCollection = require('./js/garbage-collection.js')
const path = require('path').posix
const schedule = require('node-schedule')

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

const port = 8080
const prefix = 'storage'
const storageDir = '/tmp/'
const maxAge = 3600000

app.listen(port, () => {
	fileMangement.restoreRoutes(app)

	schedule.scheduleJob('0 * * * * *', () => {
		garbageCollection.cleanupAllUnclaimed(app, storageDir, prefix, maxAge)
	})

	serveStaticFiles(path.join(__dirname, 'pages', 'static'))

	fileMangement.acceptUploads(app, storageDir, prefix)

	console.log(`app listening on port ${port}`)
})
