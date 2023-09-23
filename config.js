import { Regex } from '@companion-module/base'

export const ConfigFields = [
	{
		type: 'static-text',
		id: 'info',
		width: 12,
		label: 'Information',
		value: 'This module allows control of Ross NK series routers via NK-NET adapters',
	},
	{
		type: 'textinput',
		id: 'host',
		label: 'IP of NK-Net adapter',
		width: 12,
		regex: Regex.IP,
		required: true,
	},
	{
		type: 'number',
		id: 'router_address',
		label: 'T-Bus address of router',
		width: 12,
		min: 0,
		max: 255,
		default: 1,
		required: true,
	},
	{
		type: 'number',
		id: 'inputs',
		label: 'Number of router inputs ',
		width: 12,
		min: 1,
		max: 512,
		default: 16,
		required: true,
	},
	{
		type: 'number',
		id: 'outputs',
		label: 'Number of router outputs ',
		width: 12,
		min: 1,
		max: 512,
		default: 16,
		required: true,
	},
]
