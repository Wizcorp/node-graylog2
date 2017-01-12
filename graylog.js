var zlib = require('zlib');
var crypto = require('crypto');
var dgram = require('dgram');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var MAX_SAFE_INT = 9007199254740991;  // Number.MAX_SAFE_INTEGER


function Queue() {
	this.first = null;
	this.last = null;
}


Queue.prototype.append = function (obj) {
	if (this.last) {
		this.last.next = obj;
		this.last = obj;
	} else {
		this.first = this.last = obj;
	}
};


Queue.prototype.getOne = function () {
	var result = this.first;

	if (result) {
		this.first = result.next;
		result.next = null;

		if (result === this.last) {
			this.last = null;
		}
	}

	return result;
};


Queue.prototype.isEmpty = function () {
	return this.last === null;
};


/**
 * Graylog instances emit errors. That means you really really should listen for them,
 * or accept uncaught exceptions (node throws if you don't listen for "error").
 */

function Graylog(config) {
    EventEmitter.call(this);

    this.config = config;

    this.servers = config.servers;
    this.client = null;
    this.hostname = config.hostname || require('os').hostname();
    this.facility = config.facility || 'Node.js';
    this.deflate = config.deflate || 'optimal';
    assert(
      this.deflate === 'optimal' || this.deflate === 'always' || this.deflate === 'never',
      'deflate must be one of "optimal", "always", or "never". was "' + this.deflate + '"');

    this._bufferSize = config.bufferSize || this.DEFAULT_BUFFERSIZE;

    // state
    this._serverIterator = 0;
	this._headerPool = [];
	this._isDeflating = false;
	this._isSending = false;

	this.sendQueue = new Queue();
	this.deflateQueue = this.deflate === 'never' ? null : new Queue();
	this.alwaysDeflate = this.deflate === 'always';

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


Graylog.prototype.getServer = function () {
    if (this.servers.length === 1) {
        // common case
        return this.servers[0];
    }

    this._serverIterator += 1;

    if (this._serverIterator >= MAX_SAFE_INT) {
        this._serverIterator = 0;
    }

    return this.servers[this._serverIterator % this.servers.length];
};


Graylog.prototype.getClient = function () {
    if (!this.client) {
        this.client = dgram.createSocket('udp4');

        var that = this;

        this.client.on('error', function (error) {
            that.emit('error', error);
        });
    }

    return this.client;
};


Graylog.prototype.destroy = function () {
	this.sendQueue = null;
	this.deflateQueue = null;
	this._headerPool = [];
	this._isDeflating = false;
	this._isSending = false;

    if (this.client) {
        this.client.close();
        this.client.removeAllListeners();
        this.client = null;
	}
};

Graylog.prototype.emergency = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.EMERG);
};

Graylog.prototype.alert = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.ALERT);
};

Graylog.prototype.critical = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.CRIT);
};

Graylog.prototype.error = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.ERROR);
};

Graylog.prototype.warning = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.WARNING);
};
Graylog.prototype.warn = Graylog.prototype.warning;

Graylog.prototype.notice = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.NOTICE);
};

Graylog.prototype.info = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.INFO);
};

Graylog.prototype.log = Graylog.prototype.info;

Graylog.prototype.debug = function (short, full, fields, timestamp) {
    return this._log(short, full, fields, timestamp, this.level.DEBUG);
};


function serialize(hostname, facility, short, full, fields, timestamp, level) {
    var message = {
        version: '1.0',
        timestamp: parseInt((timestamp || Date.now()) / 1000, 10),
        host: hostname,
        facility: facility,
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

    return new Buffer(JSON.stringify(message), 'utf8');
}


Graylog.prototype._getHeadersFromPool = function (n) {
	for (var i = this._headerPool.length; i < n; i += 1) {
		var header = this._headerPool[i] = new Buffer(12);

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

	var client = this.getClient();
	var server = this.getServer();

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
	if (this._isDeflating || this.deflateQueue.isEmpty()) {
		return;
	}

	this._isDeflating = true;

	var that = this;
	var msg = this.deflateQueue.getOne();

	function done() {
		that._isDeflating = false;
		that.sendQueue.append(msg);

		that._tickSend();
		that._tickDeflate();
	}

	if (!this.alwaysDeflate && msg.buff.length <= this._bufferSize) {
		process.nextTick(done);
        return;
    }

    zlib.deflate(msg.buff, function (error, compressed) {
        if (error) {
            that.emit('warning', error);
        } else {
			that.compressed += 1;

			if (that.alwaysDeflate || compressed.length < msg.buff.length) {
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

	if (this.sendQueue.isEmpty()) {
		if (!this._isDeflating) {
			this.emit('drain');
		}
		return;
	}

	this._isSending = true;

	var that = this;
	var msg = this.sendQueue.getOne();

	function done() {
		that.sent += 1;
		that._isSending = false;
		that._tickSend();
	}

	var buff = msg.buff;
	msg.buff = null; // help GC a bit

    if (buff.length <= this._bufferSize) {
		// No need to chunk this message

		var client = this.getClient();
		var server = this.getServer();

		client.send(buff, 0, buff.length, server.port, server.host, done);
		return;
    }

    var that = this;

    // Generate a random ID (buffer)
    crypto.randomBytes(8, function (error, id) {
        if (error) {
            return cb(error);
        }

		that._sendChunked(id, buff, done);
    });
};


Graylog.prototype._log = function log(short, full, fields, timestamp, level) {
    if (!this.sendQueue) {
        return;
    }

    var message = {
		buff: serialize(this.hostname, this.facility, short, full, fields, timestamp, level),
		next: null
	};

	if (this.deflateQueue) {
		this.deflateQueue.append(message);
		this._tickDeflate();
	} else {
		this.sendQueue.append(message);
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

exports.graylog = Graylog; // deprecated
exports.Graylog = Graylog;
