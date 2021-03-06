#!/usr/bin/node

/**
 * @author James Lee
 * A simple NodeJS module for sending notification emails to the user
 */

/**
 * @module Notify
 */

'use strict'

const nodemailer = require('nodemailer')

// Email used to send an email to the user
const fromEmail = ''

// Password to the email account ^^
const fromEmailPassword = ''

module.exports = {
	/**
	* @description Send a notification email to the user telling them that their file has been downloaded
	* @param {string} toEmail - Which email address to send the message too.
	* @param {string} fileName - The name of the file which has been downloaded
	*/
	notifyFileClaimed: async(toEmail, fileName) => {
		try {
			await new Promise((resolve, reject) => {
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
				  	text: `Your file '${fileName}' has been downloaded`
				}

				transporter.sendMail(mailOptions, (error) => {
				  	if (error) {
				    	reject(error)
				  	}
				})

				resolve()
			})
		} catch(error) {
			console.error(error)
		}
	}
}
