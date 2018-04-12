/*eslint-env browser*/

'use strict'

function updateUploadForm() { // eslint-disable-line no-unused-vars
	document.getElementById('formInfo').textContent = document.getElementById('formFiles').files.length + ' files(s) selected'
}
