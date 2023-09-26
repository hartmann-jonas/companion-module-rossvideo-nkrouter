import { InstanceBase, runEntrypoint, InstanceStatus, TCPHelper } from '@companion-module/base'
import { ConfigFields } from './config.js'
import { getActions } from './actions.js'
import { UpgradeScripts } from './upgrades.js'

class NKRouterInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init() {
		const self = this
		self.config = {}
		self.options = {
			inputs: [],
			outputs: [],
		}
		self.connected = false
		self.keepAliveTimer

		self.updateStatus(InstanceStatus.Connecting)

		self.init_tcp()

		self.updateOptions()

		self.updateActions()
	}

	async configUpdated(config) {
		console.log('config changed')
		const self = this

		let reinit = false

		if (config.host != self.config.host) {
			reinit = true
		}

		self.config = config

		self.updateOptions()

		self.updateActions()
		
		if (reinit) {
			self.init_tcp()
		}
	}

	async destroy() {
		const self = this

		self.stopKeepAliveTimer()

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		self, self.updateStatus(InstanceStatus.Disconnected)
		self.log('debug', 'destroy')
	}

	async init_tcp() {
		const self = this
		console.log('init router')
		if (self.socket !== undefined) {
			self.socket.destroy()
			self.stopKeepAliveTimer()
			delete self.socket
		}

		if (self.config.host !== undefined) {
			console.log(self.config.host)
			console.log('config recieved')
			if (self.config.port === undefined) {
				self.config.port = 5000
			}
			self.socket = new TCPHelper(self.config.host, self.config.port)

			self.socket.on('status_change', function (status, message) {
				if ((self.currentStatus) == 0 && (status == 2)) {
					// disconnected from a connected state
					self.stopKeepAliveTimer()
					self.log('debug', 'Disconnected')
				}
				self.updateStatus(status, message)
			})

			self.socket.on('error', function (err) {
				// This gets spammy so it is removed currently
				// self.updateStatus(InstanceStatus.UnknownError, err)
				// self.log('error', 'Network error: ' + err.message)
			})

			self.socket.on('connect', function () {
				self.updateStatus(InstanceStatus.Ok)
				self.log('debug', 'Connected')
				self.socket.send('PHOENIX-DB N\n')
				self.startKeepAliveTimer(10000) //Timer to send HI every 10 seconds to keep connection alive
			})

			// updatethis the input and output selections for the actions
			// TODO: remove console.log
			console.log('Inputs:' + this.config.inputs)
			for (let i = 1; i <= this.config.inputs; i++) {
				this.options.inputs.push({ id: String(i), label: i.toString() })
			}

			// TODO: remove console.log
			console.log('Outputs:' + this.config.outputs)
			for (let i = 1; i <= this.config.outputs; i++) {
				this.options.outputs.push({ id: String(i), label: i.toString() })
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

	updateOptions() {
		const self = this

		for (let i =1; i <= self.config.inputs; i++) {
			self.CHOICES_INPUTS.push({ id: String(i), label: i.toString() })
		}
	
		for (let i =1; i <= self.config.outputs; i++) {
			self.CHOICES_OUTPUTS.push({ id: String(i), label: i.toString() })
		}
	}

	changeXPT(address, output, input, level) {
		const self = this

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
		const self = this

		self.stopKeepAliveTimer();

		// Create a reconnect timer to watch the socket. If disconnected try to connect.
		self.keepAliveTimer = setInterval(function () {
			self.log('debug', 'handshake')
			self.transmitCommand('HI\r')
		}, timeout)
	}

	stopKeepAliveTimer() {
		const self = this
		
		if (self.keepAliveTimer !== undefined) {
			clearInterval(self.keepAliveTimer)
			delete self.keepAliveTimer
		}
	}

	transmitCommand(command) {
		const self = this

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(command)
		} else {
			self.log('debug', 'Socket not connected :(')
		}
	}
}

runEntrypoint(NKRouterInstance, UpgradeScripts)
