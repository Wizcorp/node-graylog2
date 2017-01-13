var test = require('tape');
var Graylog = require('..');

test('small', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }], hostname: 'foo', facility: 'bar' });

	client.on('message', function (message) {
		message = JSON.parse(message);

		t.equal(message.version, '1.0');
		t.equal(typeof message.timestamp, 'number');
		t.equal(message.host, 'foo');
		t.equal(message.facility, 'bar');
		t.equal(message.level, client.level.INFO)
		t.equal(message.short_message, 'short message');
		t.equal(message.full_message, 'full message');
		t.equal(message.__id, 1);
		t.equal(message._foo, 'bar');
		t.end();
	});

	client.info('short message', 'full message', { id: 1, foo: 'bar' });
});


test('multiserver', function (t) {
	var servers = [
		{ host: '127.0.0.1', port: 12345 },
		{ host: '127.0.0.1', port: 12345 }
	];

	var client = new Graylog({ servers: servers });
	var cursor = 0;
	var count = 0;
	var total = 5;

	client.on('message', function (message, server) {
		t.equal(server, servers[cursor]);

		cursor += 1;
		count += 1;

		if (cursor >= servers.length) {
			cursor = 0;
		}

		if (count === total) {
			t.end();
		}
	});

	for (var i = 0; i < total; i += 1) {
		client.info('short message');
	}
});


test('bad host', function (t) {
	var client = new Graylog({ servers: [{ host: 'foobar', port: 12345 }] });

	client.on('error', function (error) {
		t.equal(error.code, 'ENOTFOUND');
		t.end();
	});

	client.info('short message');
});
