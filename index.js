var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.decimalToHex = function (d, pad) {
	let hex = Number(d).toString(16);

	while (hex.length < pad) {
        hex = "0" + hex;
    }

    return hex;
};

instance.prototype.crc16 = function (buffer) {
    let crc = 0xFFFF;
    let odd;

    for (let i = 0; i < buffer.length; i++) {
        crc = crc ^ buffer[i];

        for (let j = 0; j < 8; j++) {
            odd = crc & 0x0001;
            crc = crc >> 1;
            if (odd) {
                crc = crc ^ 0xA001;
            }
        }
    }

	crc = ((crc&0xFF)<<8)|((crc&0xFF00)>>8)

    return crc;
};

instance.prototype.changeXPT = function (address, output, input, level){
	var self = this;
	let string = "4e4b3200"+self.decimalToHex(address,2)+"0409"+self.decimalToHex(output,4)+self.decimalToHex(input,4)+self.decimalToHex(level,8)+"00";
	let crc = self.crc16(Buffer(string, 'hex')).toString(16);
	string = "504153320012"+string+crc;
	return(Buffer(string, 'hex'));
};


instance.prototype.updateConfig = function (config) {
	var self = this;

	self.config = config;

	self.updateOptions();

	self.init_tcp();
};

instance.prototype.init = function () {
	var self = this;

	self.commands = [];

	self.transmitOK = false;
	self.connected = false;
	self.keepAliveTimer;
	self.startTransmitTimer;

	//self.updateOptions();

	self.status(self.STATE_UNKNOWN);

	self.init_tcp();

	self.actions();
};

instance.prototype.init_tcp = function () {
	var self = this;

	// var connected = false;

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.host) {
		self.commands = [];

		if (self.config.port === undefined) {
			self.config.port = 5000;
		}
		self.socket = new tcp(self.config.host, 5000);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			self.log('debug', "Network error", err);
			self.status(self.STATE_ERROR, err);
			self.log('error', "Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			self.status(self.STATE_OK);
			self.log('debug', "Connected");
			self.socket.send("PHOENIX-DB N\n");
			self.startKeepAliveTimer(10000); //Timer to send HI every 10 seconds to keep connection alive
			self.startTransmitTimer(10);
		});
	}
};

instance.prototype.startKeepAliveTimer = function(timeout) {
	var self = this;

	// Stop the timer if it was already running
	self.stopKeepAliveTimer();

	self.log('info', "Starting keepAliveTimer");
	// Create a reconnect timer to watch the socket. If disconnected try to connect.
	self.keepAliveTimer = setInterval(function(){
		self.commands.push("HI\r");
	}, timeout);
};

instance.prototype.stopKeepAliveTimer = function() {
	var self = this;

	self.log('info', "Stopping keepAliveTimer");
	if (self.keepAliveTimer !== undefined) {
		clearInterval(self.keepAliveTimer);
		delete self.keepAliveTimer;
	}

};

instance.prototype.startTransmitTimer = function(timeout) {
	var self = this;

	// Stop the timer if it was already running
	self.stopTransmitTimer();

	self.log('info', "Starting transmitTimer");
	// Create a reconnect timer to watch the socket. If disconnected try to connect.
	self.transmitTimer = setInterval(function(){
		self.transmitCommands();
	}, timeout);
};

instance.prototype.stopTransmitTimer = function() {
	var self = this;

	self.log('info', "Stopping transmitTimer");
	if (self.transmitTimer !== undefined) {
		clearInterval(self.transmitTimer);
		delete self.transmitTimer;
	}

};

instance.prototype.transmitCommands = function(){
	var self = this;

	if(self.commands.length){
		var command = self.commands.shift()
		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(command);
		}
		else {
			self.log('debug', 'Socket not connected :(');
		}
	}
}

instance.prototype.updateOptions = function(){
	var self = this;

	self.levels = [];
	self.inputs = [];
	self.outputs = [];

	self.levels.push({id: 1, label: 'MD Video'});
	self.levels.push({id: 2, label: 'SDI Video'});
	self.levels.push({id: 4, label: 'AES Audio 1'});
	self.levels.push({id: 8, label: 'AES Audio 2'});
	self.levels.push({id: 16, label: 'Analog Video'});
	self.levels.push({id: 32, label: 'Analog Audio 1'});
	self.levels.push({id: 64, label: 'Analog Audio 2'});
	self.levels.push({id: 128, label: 'Machine Control'});

	for (let i =1; i <= self.config.inputs; i++) {
		self.inputs.push({ id: i, label: i.toString() })
	}

	for (let i =1; i <= self.config.outputs; i++) {
		self.outputs.push({ id: i, label: i.toString() })
	}
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module allows control of Ross NK series routers via NK-NET adapters'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'IP of NK-Net adapter',
			width: 12,
			regex: self.REGEX_IP
		},
		{
			type: 'number',
			id: 'router_address',
			label: 'T-Bus address of router',
			width: 12,
			min: 0,
			max: 255,
			default: 1,
			required: true
		},
		{
			type: 'number',
			id: 'inputs',
			label: 'Number of router inputs ',
			width: 12,
			min: 1,
			max: 512,
			default: 1,
			required: true
		},
		{
			type: 'number',
			id: 'outputs',
			label: 'Number of router outputs ',
			width: 12,
			min: 1,
			max: 512,
			default: 1,
			required: true
		}
	];
};

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	self.log('debug', "destroy", self.id);
};

instance.prototype.actions = function(system) {
	var self = this;

	self.updateOptions();

	self.system.emit('instance_actions', self.id, {
		'routerXPT':{
			label: 'Router Crosspoint',
			options: [
				{
					type: 'dropdown',
					label: 'Level',
					id: 'level',
					default: 1,
					choices: self.levels
				},
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: 1,
					choices: self.inputs
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 1,
					choices: self.outputs
				}
			]
		},

	});
};

instance.prototype.action = function(action) {
	var self = this;
	const id = action.action;
	const opt = action.options;
	let cmd = "";


	switch (id){
		case 'routerXPT':
			cmd = self.changeXPT(self.config.router_address, opt.output-1, opt.input-1, opt.level);
			self.commands.push(cmd);
			break;
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
