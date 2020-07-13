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

	if(output < self.config.outputs){
		if(input < self.config.inputs){
			let string = "4e4b3200"+self.decimalToHex(address,2)+"0409"+self.decimalToHex(output,4)+self.decimalToHex(input,4)+self.decimalToHex(level,8)+"00";
			let crc = self.crc16(Buffer(string, 'hex')).toString(16);
			string = "504153320012"+string+crc;

			self.transmitCommand(Buffer(string, 'hex'));
		}
		else{
			self.log('error', "Selected input out of bounds")
		}
	}
	else{
		self.log('error', "Selected output out of bounds")
	}
};

instance.prototype.updateConfig = function (config) {
	var self = this;

	let reinit = false;

	if(config.host != self.config.host){ //Not checking port since it isn't user editable currently.
		reinit = true;
	}

	self.config = config;

	self.updateOptions();

	self.actions();

	if(reinit){
		self.init_tcp();
	}
};

instance.prototype.init = function () {
	var self = this;

	self.connected = false;
	self.keepAliveTimer;

	self.status(self.STATE_UNKNOWN);

	self.init_tcp();

	self.updateOptions();

	self.actions();
};

instance.prototype.init_tcp = function () {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		self.stopKeepAliveTimer();
		delete self.socket;
	}

	if (self.config.host) {

		if (self.config.port === undefined) {
			self.config.port = 5000;
		}
		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', function (status, message) {
			if((self.currentStatus == 0) && (status == 2)){
				//disconnected from a connected state
				self.stopKeepAliveTimer(); //Disconnected so stop the timer
				self.log('debug', "Disconnected");
			}
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			//This gets spammy so it is removed currently
			//self.status(self.STATE_ERROR, err);
			//self.log('error', "Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			self.status(self.STATE_OK);
			self.log('debug', "Connected");
			self.socket.send("PHOENIX-DB N\n");
			self.startKeepAliveTimer(10000); //Timer to send HI every 10 seconds to keep connection alive
		});
	}
};

instance.prototype.startKeepAliveTimer = function(timeout) {
	var self = this;

	self.stopKeepAliveTimer();

	// Create a reconnect timer to watch the socket. If disconnected try to connect.
	self.keepAliveTimer = setInterval(function(){
		self.transmitCommand("HI\r");
	}, timeout);
};

instance.prototype.stopKeepAliveTimer = function() {
	var self = this;

	if (self.keepAliveTimer !== undefined) {
		clearInterval(self.keepAliveTimer);
		delete self.keepAliveTimer;
	}

};

instance.prototype.transmitCommand = function(command){
	var self = this;

	if (self.socket !== undefined && self.socket.connected) {
		self.socket.send(command);
	}
	else {
		self.log('debug', 'Socket not connected :(');
	}
}

instance.prototype.updateOptions = function(){
	var self = this;

	self.CHOICES_LEVELS = [];
	self.CHOICES_INPUTS = [];
	self.CHOICES_OUTPUTS = [];

	self.CHOICES_LEVELS.push({id: "1", label: 'MD Video'});
	self.CHOICES_LEVELS.push({id: "2", label: 'SDI Video'});
	self.CHOICES_LEVELS.push({id: "4", label: 'AES Audio 1'});
	self.CHOICES_LEVELS.push({id: "8", label: 'AES Audio 2'});
	self.CHOICES_LEVELS.push({id: "16", label: 'Analog Video'});
	self.CHOICES_LEVELS.push({id: "32", label: 'Analog Audio 1'});
	self.CHOICES_LEVELS.push({id: "64", label: 'Analog Audio 2'});
	self.CHOICES_LEVELS.push({id: "128", label: 'Machine Control'});

	for (let i =1; i <= self.config.inputs; i++) {
		self.CHOICES_INPUTS.push({ id: String(i), label: i.toString() })
	}

	for (let i =1; i <= self.config.outputs; i++) {
		self.CHOICES_OUTPUTS.push({ id: String(i), label: i.toString() })
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
			regex: self.REGEX_IP,
			required: true
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
			default: 16,
			required: true
		},
		{
			type: 'number',
			id: 'outputs',
			label: 'Number of router outputs ',
			width: 12,
			min: 1,
			max: 512,
			default: 16,
			required: true
		}
	];
};

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this;

	self.stopKeepAliveTimer()

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	self.log('debug', "destroy", self.id);
};

instance.prototype.actions = function(system) {
	var self = this;

	self.setActions({
		'routerXPT':{
			label: 'Router Crosspoint',
			options: [
				{
					type: 'dropdown',
					label: 'Level',
					id: 'level',
					default: "1",
					choices: self.CHOICES_LEVELS
				},
				{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: "1",
					choices: self.CHOICES_INPUTS
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: "1",
					choices: self.CHOICES_OUTPUTS
				}
			]
		},

	});
};

instance.prototype.action = function(action) {
	var self = this;
	const id = action.action;
	const opt = action.options;

	switch (id){
		case 'routerXPT':
			self.changeXPT(self.config.router_address, opt.output-1, opt.input-1, opt.level);
			break;
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
