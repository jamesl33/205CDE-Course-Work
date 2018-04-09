#!/usr/bin/node

/**
 * @author James Lee
 * A simple NodeJS module for sending notification emails to the user
 */

'use strict'

const nodemailer = require('nodemailer')

const fromEmail = ''
const fromEmailPassword = ''

module.exports = {
	/**
	* @description Send a notification email to the user telling them that their file has been downloaded
	* @param {string} toEmail - Which email address to send the message too.
	* @param {string} fileName - The name of the file which has been downloaded
	*/
	notifyFileClaimed: function(toEmail, fileName) {
		const transporter = nodemailer.createTransport({
		  	service: 'gmail',
		  	auth: {
		    	user: fromEmail,
		    	pass: fromEmailPassword
		  	}
		})

		const mailOptions = {
		  	from: '',
		  	to: toEmail,
		  	subject: 'Private Share File Claimed',
		  	text: `Your file ${fileName} has been downloaded`
		}

		transporter.sendMail(mailOptions, (error) => {
		  	if (error) {
		    	console.error(error)
		  	}
		})
	}
}
