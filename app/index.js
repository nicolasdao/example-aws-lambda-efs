const fs = require('fs')
const cp = require('child_process')

const exec = cmd => new Promise((next,fail) => cp.exec(cmd, (error, stdout) => error ? fail(error) : next(stdout)))

exports.handler = async event => {
	const files = fs.readdirSync('/')
	const msg = await exec('git --version')
	return {
		statusCode: 200,
		body: JSON.stringify({
			message: 'Hello',
			files,
			msg
		})
	}
}