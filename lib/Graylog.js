var zlib = require('zlib');
var crypto = require('crypto');
var dgram = require('dgram');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Queue = require('./Queue');

var MAX_SAFE_INT = 9007199254740991;  // Number.MAX_SAFE_INTEGER

/**
 * Graylog instances emit errors. That means you really really should listen for them,
 * or accept uncaught exceptions (node throws if you don't listen for "error").
 */

function Graylog(config) {
    EventEmitter.call(this);

	// settings (all safe to change at runtime through these setters)
	this.setServers(config.servers);
	this.setHostname(config.hostname || require('os').hostname());
	this.setFacility(config.facility || 'Node.js');
	this.setBufferSize(config.bufferSize || this.DEFAULT_BUFFERSIZE);
	this.setDeflate(config.deflate || 'optimal');

    // state
	this._client = null;
    this._serverIterator = 0;
	this._headerPool = [];
	this._isDeflating = false;
	this._isSending = false;

	this._sendQueue = new Queue();
	this._deflateQueue = new Queue();

	// stats
	this.sent = 0;
	this.compressed = 0;
}

util.inherits(Graylog, EventEmitter);

Graylog.prototype.DEFAULT_BUFFERSIZE = 1400;  // a bit less than a typical MTU of 1500 to be on the safe side

Graylog.prototype.level = {
    EMERG: 0,    // system is unusable
    ALERT: 1,    // action must be taken immediately
    CRIT: 2,     // critical conditions
    ERROR: 3,    // error conditions
    WARNING: 4,  // warning conditions
    NOTICE: 5,   // normal, but significant, condition
    INFO: 6,     // informational message
    DEBUG: 7     // debug level message
};


Graylog.prototype.setServers = function (servers) {
	if (!Array.isArray(servers)) {
		throw new TypeError('Servers must be an array');
	}

	if (servers.length === 0) {
		throw new Error('Servers array cannot be empty');
	}

	for (var i = 0; i < servers.length; i += 1) {
		var server = servers[i];
		if (!server || typeof server !== 'object') {
			throw new TypeError('A server entry must be an object with "host" and "port" properties');
		}

		if (!server.hasOwnProperty('host') || !server.hasOwnProperty('port')) {
			throw new TypeError('A server entry must be an object with "host" and "port" properties');
		}

		if (typeof server.host !== 'string') {
			throw new TypeError('A server host must be a string');
		}

		if (typeof server.port !== 'number') {
			throw new TypeError('A server port must be a number');
		}
	}

	this._servers = servers;
};


Graylog.prototype.setHostname = function (hostname) {
	if (typeof hostname !== 'string') {
		throw new TypeError('Host name must be a string');
	}

	this._hostname = hostname;
};


Graylog.prototype.setFacility = function (facility) {
	if (typeof facility !== 'string') {
		throw new TypeError('Facility must be a string');
	}

	this._facility = facility;
};


Graylog.prototype.setBufferSize = function (bufferSize) {
	if (typeof bufferSize !== 'number') {
		throw new TypeError('Buffer size must be a number');
	}

	this._bufferSize = bufferSize;
};


Graylog.prototype.setDeflate = function (deflate) {
	if (deflate !== 'optimal' && deflate !== 'always' && deflate !== 'never') {
		throw new Error('deflate must be "optimal", "always", or "never". was "' + deflate + '"');
	}

	this._neverDeflate = deflate === 'never';
	this._alwaysDeflate = deflate === 'always';
};


Graylog.prototype._getServer = function () {
    if (this._servers.length === 1) {
        // common case
        return this._servers[0];
    }

    if (this._serverIterator >= MAX_SAFE_INT) {
        this._serverIterator = 0;
    }

    return this._servers[this._serverIterator++ % this._servers.length];
};


Graylog.prototype._getClient = function () {
    if (!this._client) {
        this._client = dgram.createSocket('udp4');

		this._client.unref();

		var that = this;

        this._client.on('error', function (error) {
			// When a callback is passed to client.send(), this event does not fire.
            that.emit('error', error);
        });
    }

    return this._client;
};


Graylog.prototype.destroy = function () {
	this._sendQueue = null;
	this._deflateQueue = null;
	this._headerPool = [];
	this._isDeflating = false;
	this._isSending = false;

    if (this._client) {
        this._client.close();
        this._client.removeAllListeners();
        this._client = null;
	}
};

Graylog.prototype.emergency = function (short, full, fields, timestamp) {
    this._log(this.level.EMERG, short, full, fields, timestamp);
};

Graylog.prototype.alert = function (short, full, fields, timestamp) {
    this._log(this.level.ALERT, short, full, fields, timestamp);
};

Graylog.prototype.critical = function (short, full, fields, timestamp) {
    this._log(this.level.CRIT, short, full, fields, timestamp);
};

Graylog.prototype.error = function (short, full, fields, timestamp) {
    this._log(this.level.ERROR, short, full, fields, timestamp);
};

Graylog.prototype.warning = function (short, full, fields, timestamp) {
    this._log(this.level.WARNING, short, full, fields, timestamp);
};

Graylog.prototype.notice = function (short, full, fields, timestamp) {
    this._log(this.level.NOTICE, short, full, fields, timestamp);
};

Graylog.prototype.info = function (short, full, fields, timestamp) {
    this._log(this.level.INFO, short, full, fields, timestamp);
};

Graylog.prototype.debug = function (short, full, fields, timestamp) {
    this._log(this.level.DEBUG, short, full, fields, timestamp);
};

Graylog.prototype.log = Graylog.prototype.info;
Graylog.prototype.warn = Graylog.prototype.warning;


Graylog.prototype._serialize = function (level, short, full, fields, timestamp) {
    var message = {
        version: '1.0',
        timestamp: parseInt((timestamp || Date.now()) / 1000, 10),
        host: this._hostname,
        facility: this._facility,
        level: level,
        short_message: short === null ? undefined : short,
        full_message: full === null ? undefined : full
    };

    // We insert additional fields

	if (fields) {
		for (var field in fields) {
	        if (field === 'id') {
	            // http://docs.graylog.org/en/2.1/pages/gelf.html
	            message.__id = fields.id;
	        } else {
	            message['_' + field] = fields[field];
	        }
	    }
	}

    return Buffer.from(JSON.stringify(message), 'utf8');
};


Graylog.prototype._getHeadersFromPool = function (n) {
	for (var i = this._headerPool.length; i < n; i += 1) {
		var header = this._headerPool[i] = Buffer.alloc(12);

		// Set the magic number (bytes 0 and 1)
        header[0] = 30;
        header[1] = 15;

		// Set the chunk sequence number (byte 10)
        header[10] = i;
	}

	return this._headerPool;
};


Graylog.prototype._sendChunked = function (id, message, cb) {
	var maxDataSize = this._bufferSize - 12; // the message part of each chunk is the buffer size - header size
	var chunkCount = Math.ceil(message.length / maxDataSize);

	if (chunkCount > 128) {
		return cb(new Error('Graylog2 message too long: ' + message.length + ' bytes'));
	}

	var client = this._getClient();
	var server = this._getServer();

	var headers = this._getHeadersFromPool(chunkCount);
	var msgOffset = 0;

	for (var i = 0; i < chunkCount; i += 1) {
		var header = headers[i];

		// Set the message id (bytes 2-9)
		id.copy(header, 2);

		// Set the total number of chunks (byte 11)
		header[11] = chunkCount;

		// Slice out the message part
		var data = message.slice(msgOffset, msgOffset + maxDataSize);

		this.emit('chunk', header, data, i, chunkCount, server);

		if (i < chunkCount - 1) {
			client.send([header, data], server.port, server.host);

			msgOffset += maxDataSize;
		} else {
			client.send([header, data], server.port, server.host, cb);
		}
	}
};


var count = 0;

Graylog.prototype._tickDeflate = function () {
	if (this._isDeflating || this._deflateQueue.isEmpty()) {
		return;
	}

	this._isDeflating = true;

	var that = this;
	var msg = this._deflateQueue.getOne();

	function done() {
		that._isDeflating = false;
		that._sendQueue.append(msg);

		that._tickSend();
		that._tickDeflate();
	}

	if (!this._alwaysDeflate && msg.buff.length <= this._bufferSize) {
		process.nextTick(done);
        return;
    }

    zlib.deflate(msg.buff, function (error, compressed) {
        if (error) {
            that.emit('warning', error);
        } else {
			that.compressed += 1;

			if (that._alwaysDeflate || compressed.length < msg.buff.length) {
				msg.buff = compressed;
			}
        }

		done();
    });
};


Graylog.prototype._tickSend = function () {
	if (this._isSending) {
		return;
	}

	if (this._sendQueue.isEmpty()) {
		if (!this._isDeflating) {
			this.emit('drain');
		}
		return;
	}

	this._isSending = true;

	var that = this;
	var msg = this._sendQueue.getOne();

	function done(error) {
		that._isSending = false;

		if (error) {
			that.emit('error', error);
		}

		that.sent += 1;
		that._tickSend();
	}

	var buff = msg.buff;
	msg.buff = null; // help GC a bit

    if (buff.length <= this._bufferSize) {
		// No need to chunk this message

		var client = this._getClient();
		var server = this._getServer();

		this.emit('message', buff, server);

		client.send(buff, 0, buff.length, server.port, server.host, done);
		return;
    }

    // Generate a random ID (buffer)
    crypto.randomBytes(8, function (error, id) {
        if (error) {
            return done(error);
        }

		that._sendChunked(id, buff, done);
    });
};


Graylog.prototype._log = function log(level, short, full, fields, timestamp) {
    if (!this._sendQueue) {
		// destroyed
		this.emit('warning', new Error('Trying to send on a closed client'));
        return;
    }

    var message = {
		buff: this._serialize(level, short, full, fields, timestamp),
		next: null
	};

	if (!this._neverDeflate) {
		this._deflateQueue.append(message);
		this._tickDeflate();
	} else {
		this._sendQueue.append(message);
		this._tickSend();
	}
};


Graylog.prototype.close = function (cb) {
	if (!cb) {
		cb = function () {};
	}

    if (!this._isSending && !this._isDeflating) {
        this.destroy();
        return cb();
    }

    var that = this;

    this.once('drain', function () {
        that.destroy();
		cb();
    });
};


module.exports = Graylog;
