#!/usr/bin/node

/**
 * @author James Lee
 * A simple module to remove routes created using app.VERB.
 */

/**
 * @module Route Remover
 */

'use strict'

module.exports = {
	/**
	 * @description Remove a route from the express router {app._router}.
	 * @param {express-router} app - The current Express router.
	 * @param {string} path - The path which should be removed.
	 */
	removeRouteByPath: async(app, path) => {
		try {
			await new Promise((resolve) => {
				app._router.stack.map((route, index) => {
					if (route.path === path) {
						app._router.stack.splice(index, 1)
					}

					try {
						if (route.route.path === path) {
							app._router.stack.splice(index, 1)
						}
					} catch (TypeError) {
						// continue if route.route.path is undefined.
					}
				})

				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	}
}
