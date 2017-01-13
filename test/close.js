var test = require('tape');
var Graylog = require('..');

test('drain', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'never' });
	var total = 100;
	var sent = 0;
	var received = 0;

	client.on('chunk', function (header, data, i, count) {
		if (i === count - 1) {
			received += 1;
		}
	});

	client.on('drain', function () {
		t.equal(sent, total);
		t.equal(received, total);
		t.end();
	});

	for (var i = 0; i < total; i++) {
		client.info('short message', 'full message'.repeat(1000));
		sent += 1;
	}
});


test('graceful close', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], deflate: 'never' });
	var total = 100;
	var sent = 0;
	var received = 0;

	client.on('chunk', function (header, data, i, count) {
		if (i === count - 1) {
			received += 1;
		}
	});

	for (var i = 0; i < total; i++) {
		client.info('short message', 'full message'.repeat(1000));
		sent += 1;
	}

	client.close(function () {
		t.equal(sent, total);
		t.equal(received, total);
		t.end();
	});
});


test('instant close', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }] });

	client.close(function () {
		t.end();
	});
});


test('send after close', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }] });

	client.on('warning', function () {
		t.end();
	});

	client.close(function () {
		client.info('short message');
	});
});
