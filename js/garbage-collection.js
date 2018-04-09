#!/usr/bin/node

/**
 * @author James Lee
 * A simple module to allow the deletion of old files for Private Share
 */

/**
 * @module Garbage Collector
 */

'use strict'

const database = require('./database.js')
const routeRemover = require('./express-route-remover.js')
const fs = require('fs')
const path = require('path').posix
const rimraf = require('rimraf')

module.exports = {
	/**
	 * @description Remove and unclaimed file download and it's Express routes.
	 * @param {express-router} app - The current Express router.
	 * @param {string} storageDir - The directory where files are being stored.
	 * @param {string} folder - Path to folder to be removed.
	 */
	removeUnclaimedFolder: async(app, storageDir, folder) => {
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
						return reject(error)
					}

					files.map(file => {
						database.removeRow(file)
					})
				})

				rimraf(path.join(storageDir, folder), (error) => {
					if (error) {
						return reject(error)
					}
				})

				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	},

	/**
	 * @description Remove all files which have been stored on the server for {maxAge} amount of time.
	 * @param {string} storageDir - Directory where the server stores the files.
	 * @param {string} prefix - Prefix for the storage files.
	 * @param {integer} maxAge - How long a file can be stored on the server in seconds.
	 */
	cleanupAllUnclaimed: async(app, storageDir, prefix, maxAge) => {
		try {
			await new Promise((resolve, reject) => {
				fs.readdir(storageDir, (error, files) => {
					if (error) {
						return reject(error)
					}

					files.map(folder => {
						if (folder.split('-').shift() !== prefix) {
							return
						}

						fs.stat(path.join(storageDir, folder), (error, stats) => {
							if (error) {
								return reject(error)
							}

							const timeNow = new Date().getTime()
							const fileTime = new Date(stats.ctime).getTime() + maxAge

							if (timeNow > fileTime) {
								module.exports.removeUnclaimedFolder(app, storageDir, folder)
							}
						})
					})

					resolve()
				})
			})
		} catch(error) {
			console.error(error)
		}
	}
}
