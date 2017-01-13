var test = require('tape');
var zlib = require('zlib');
var Graylog = require('..');

test('compressed', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'optimal' });

	client.on('message', function (message) {
		message = JSON.parse(zlib.inflateSync(message));

		t.equal(message.short_message, 'short message');
		t.equal(message.full_message, 'full message'.repeat(1000));
		t.end();
	});

	client.info('short message', 'full message'.repeat(1000));
});


test('forced compressed', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'always' });

	client.on('message', function (message) {
		message = JSON.parse(zlib.inflateSync(message));

		t.equal(message.short_message, 'short message');
		t.equal(message.full_message, 'full message');
		t.end();
	});

	client.info('short message', 'full message');
});


test('compression error handling', function (t) {
	var oldDeflate = zlib.deflate;
	zlib.deflate = function (buff, cb) {
		cb(new Error('Oops'));
	};

	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'always' });

	client.on('warning', function (error) {
		zlib.deflate = oldDeflate;
		t.end();
	});

	client.info('short message', 'full message');
});
