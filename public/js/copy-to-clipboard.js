'use strict'

function copyToClipboard() {
	const copyText = document.getElementById('shareURL')
	copyText.select()
	document.execCommand('Copy')
}
