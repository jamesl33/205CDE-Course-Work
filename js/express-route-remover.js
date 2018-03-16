#!/usr/bin/node

/**
 * @author James Lee
 * A simple module to remove routes created using app.VERB.
 */

'use strict'

module.exports = {
	/**
	 * @name removeRouteByPath
	 * @description Remove a route from the express router {app._router}.
	 * @param app The express object as created with {const app = express()}.
	 * @param path The path which should be removed.
	 */
	removeRouteByPath: async function(app, path, callback) {
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
			callback(new Error(error.message))
		}
	}
}
