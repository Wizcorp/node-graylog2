var test = require('tape');
var zlib = require('zlib');
var Graylog = require('..');

test('chunked', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'never' });
	var buffers = [];

	client.on('chunk', function (header, data, i, count) {
		buffers.push(data);

		t.equal(header[10], i);
		t.equal(header[11], count);

		if (i === count - 1) {
			var message = JSON.parse(Buffer.concat(buffers));

			t.equal(message.short_message, 'short message');
			t.equal(message.full_message, 'full message'.repeat(1000));
			t.end();
		}
	});

	client.info('short message', 'full message'.repeat(1000));
});


test('compressed chunked', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'optimal', bufferSize: 100 });
	var buffers = [];

	client.on('chunk', function (header, data, i, count) {
		buffers.push(data);

		t.equal(header[10], i);
		t.equal(header[11], count);

		if (i === count - 1) {
			var message = JSON.parse(zlib.inflateSync(Buffer.concat(buffers)));

			t.equal(message.short_message, 'short message');
			t.equal(message.full_message, 'full message'.repeat(1000));
			t.end();
		}

	});

	client.info('short message', 'full message'.repeat(1000));
});


test('too big', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'never', bufferSize: 20 });

	client.on('error', function () {
		t.end();
	});

	client.info('short message', 'full message'.repeat(1000));
});


test('crypto error', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'never' });
	var crypto = require('crypto');

	var oldRandomBytes = crypto.randomBytes;

	crypto.randomBytes = function (n, cb) {
		cb(new Error('Oops'));
	};

	client.on('error', function () {
		crypto.randomBytes = oldRandomBytes;
		t.end();
	});

	client.info('short message', 'full message'.repeat(1000));
});
