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
						// Remove the route if it contains the correct path
						app._router.stack.splice(index, 1)
					}

					// Attempt to go one layer deeper (if this is not done some paths will remain)
					try {
						if (route.route.path === path) {
							// Remove the route if it contains the correct path
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
