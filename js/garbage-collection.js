#!/usr/bin/node

/**
 * @author James Lee
 * A simple module to allow the deletion of old files for Private Share
 */

'use strict'

const database = require('./database.js')
const dynamicRoutes = require('./dynamic-routes.js')
const fs = require('fs')
const path = require('path').posix
const rimraf = require('rimraf')

module.exports = {
	/**
	 * @description Remove an unclamied folder
	 * @param {string} name of folder to be removed
	 */
	removeUnclaimedFolder: async function(app, storageDir, folder) {
		console.log('Removed File')

		try {
			await new Promise((resolve, reject) => {
				let id = folder.split('-')
				id.shift()
				id = id.join('-')

				const routes = ['/' + id, '/share/' + id, '/download/' + id]

				routes.map(route => {
					dynamicRoutes.removeRouteByPath(app, route)
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
	 * @description Remove any storage directories from the last time that the server was run.
	 * @param {string} storageDir Directory to search in.
	 * @param {string} prefix Prefix for the storage files {default: storage-}.
	 */
	cleanupAllUnclaimed: async function(app, storageDir, prefix, maxAge) {
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
								this.removeUnclaimedFolder(app, storageDir, folder)
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
