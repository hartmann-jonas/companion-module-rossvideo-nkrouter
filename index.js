import { InstanceBase, InstanceStatus, runEntrypoint, TCPHelper } from '@companion-module/base'
import { ConfigFields } from './config.js'
import { getActions } from './actions.js'

class NKRouterInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		console.log('init')
		this.startup(config)
	}

	async destroy() {
		var self = this

		if (this.keepAliveTimer != undefined) {
			clearInterval(this.keepAliveTimer)
			delete this.keepAliveTimer
		}

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		this, this.updateStatus(InstanceStatus.Disconnected)
		self.log('debug', 'destroy')
	}

	startup(config) {
		console.log('startup')
		this.config = config
		this.options = {
			inputs: [],
			outputs: [],
		}

		this.updateActions()
		this.initRouter()
	}

	async initRouter() {
		console.log('init router')
		const self = this
		if (this.keepAliveTimer != undefined) {
			clearInterval(this.keepAliveTimer)
			delete this.keepAliveTimer
		}

		if (this.config.host) {
			const config = this.config

			// default to port 5000 if undefindes
			if (config.port === undefined) {
				config.port = 5000
			}
			self.socket = new TCPHelper(config.host, config.port)

			self.socket.on('status_change', function (status, message) {
				if (self.currentStatus == 0 && status == 2) {
					// socket disconnected
					self.stopKeepAliveTimer()
					self.log('debug', 'Disconnected')
				}
				self.updateStatus(status, message)
			})

			self.socket.on('error', function (err) {
				//This gets spammy so it is removed currently
				self.updateStatus(InstanceStatus.UnknownError, err)
				self.log('error', 'Network error: ' + err.message)
			})

			self.socket.on('connect', function () {
				self.updateStatus(InstanceStatus.Ok)
				self.log('debug', 'Connected')
				self.socket.send('PHOENIX-DB N\n')
				self.startKeepAliveTimer(10000) //Timer to send HI every 10 seconds to keep connection alive
			})

			// update the input and output selections for the actions
			// TODO: remove console.log
			console.log('Inputs:' + self.config.inputs)
			for (let i = 1; i <= self.config.inputs; i++) {
				self.options.inputs.push({ id: String(i), label: i.toString() })
			}

			// TODO: remove console.log
			console.log('Outputs:' + self.config.outputs)
			for (let i = 1; i <= self.config.outputs; i++) {
				self.options.outputs.push({ id: String(i), label: i.toString() })
			}

			this.log('debug', 'Action options updated')
			this.log('debug', 'Router init finished')
		}
	}

	getConfigFields() {
		return ConfigFields
	}

	updateActions() {
		this.setActionDefinitions(getActions(this))
	}

	changeXPT(address, output, input, level) {
		var self = this

		if (output < self.config.outputs) {
			if (input < self.config.inputs) {
				console.log(level)
				if (level <= 255 && level != 0) {
					let string =
						'4e4b3200' +
						self.decimalToHex(address, 2) +
						'0409' +
						self.decimalToHex(output, 4) +
						self.decimalToHex(input, 4) +
						self.decimalToHex(level, 8) +
						'00'
					let crc = self.crc16(Buffer(string, 'hex')).toString(16)
					string = '504153320012' + string + crc

					self.transmitCommand(Buffer(string, 'hex'))
				} else {
					self.log('error', 'Selected level out of bounds')
				}
			} else {
				self.log('error', 'Selected input out of bounds')
			}
		} else {
			self.log('error', 'Selected output out of bounds')
		}
	}

	// helper functions
	decimalToHex(d, pad) {
		let hex = Number(d).toString(16)

		while (hex.length < pad) {
			hex = '0' + hex
		}

		return hex
	}

	crc16(buffer) {
		let crc = 0xffff
		let odd

		for (let i = 0; i < buffer.length; i++) {
			crc = crc ^ buffer[i]

			for (let j = 0; j < 8; j++) {
				odd = crc & 0x0001
				crc = crc >> 1
				if (odd) {
					crc = crc ^ 0xa001
				}
			}
		}

		crc = ((crc & 0xff) << 8) | ((crc & 0xff00) >> 8)

		return crc
	}

	startKeepAliveTimer(timeout) {
		var self = this

		if (this.keepAliveTimer != undefined) {
			clearInterval(this.keepAliveTimer)
			delete this.keepAliveTimer
		}

		this.log('debug', 'say hi!')
		// Create a reconnect timer to watch the socket. If disconnected try to connect.
		self.keepAliveTimer = setInterval(function () {
			self.transmitCommand('HI\r')
			console.log('HI')
		}, timeout)
	}

	transmitCommand(command) {
		var self = this

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(command)
		} else {
			self.log('debug', 'Socket not connected :(')
		}
	}
}

runEntrypoint(NKRouterInstance, [])
