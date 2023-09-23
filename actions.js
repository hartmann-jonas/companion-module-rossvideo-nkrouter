export function getActions(self) {
	return {
		routerXPT: {
			name: 'Router Crosspoint',
			options: [
				{
					type: 'multidropdown',
					label: 'Level',
					id: 'level',
					default: '1',
					choices: [
						{ id: '1', label: 'MD Video' },
						{ id: '2', label: 'SDI Video' },
						{ id: '4', label: 'AES Audio 1' },
						{ id: '8', label: 'AES Audio 2' },
						{ id: '16', label: 'Analog Video' },
						{ id: '32', label: 'Analog Audio 1' },
						{ id: '64', label: 'Analog Audio 2' },
						{ id: '128', label: 'Machine Control' },
					],
					minSelection: 1,
				},
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: '1',
					choices: self.options.inputs,
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: '1',
					choices: self.options.outputs,
				},
			],
			callback: async (event) => {
				const options = event.options
				let level = 0
				// QUESTION: what does this do?
				for (let value of options.level) {
					level += Number(value)
					console.log(level)
				}
				self.changeXPT(self.config.router_address, options.output - 1, options.input - 1, level)
			},
		},
	}
}
