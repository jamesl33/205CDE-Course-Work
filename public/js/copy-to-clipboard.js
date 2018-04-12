/*eslint-env browser*/

'use strict'

function copyToClipboard() { // eslint-disable-line no-unused-vars
	const copyText = document.getElementById('shareURL')
	copyText.select()
	document.execCommand('Copy')
}
