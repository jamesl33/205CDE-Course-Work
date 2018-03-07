module.exports = {
    removeRouteByPath: (app, path) => {
        app._router.stack.map((route, index) => {
            if (route.path == path) {
                app._router.stack.splice(index, 1);
            }

            try {
                if (route.route.path == path) {
                    app._router.stack.splice(index, 1);
                }
            } catch (Typeerr) {

            }
        });
    }
};
