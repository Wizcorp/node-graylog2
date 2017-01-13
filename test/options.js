var test = require('tape');
var Graylog = require('..');

test('options', function (t) {
	t.throws(function () {
		new Graylog();
	});

	t.throws(function () {
		new Graylog({ servers: 'foo' });
	});

	t.throws(function () {
		new Graylog({ servers: [] });
	});

	t.throws(function () {
		new Graylog({ servers: ['foo'] });
	});

	t.throws(function () {
		new Graylog({ servers: [{}] });
	});

	t.throws(function () {
		new Graylog({ servers: [{ host: 1, port: 1 }] });
	});

	t.throws(function () {
		new Graylog({ servers: [{ host: 0, port: 'bar' }] });
	});

	t.throws(function () {
		new Graylog({ servers: [{ host: 'foo', port: 'foo' }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ servers: [{ host: 'foo', port: 12345 }] });
	});

	t.throws(function () {
		new Graylog({ hostname: 1, servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ hostname: 'bar', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.throws(function () {
		new Graylog({ facility: 1, servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ facility: 'bar', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.throws(function () {
		new Graylog({ bufferSize: 'foo', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ bufferSize: 100, servers: [{ host: 'foo', port: 12345 }] });
	});

	t.throws(function () {
		new Graylog({ deflate: 1, servers: [{ host: 'foo', port: 12345 }] });
	});

	t.throws(function () {
		new Graylog({ deflate: 'foo', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ deflate: 'optimal', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ deflate: 'always', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.doesNotThrow(function () {
		new Graylog({ deflate: 'never', servers: [{ host: 'foo', port: 12345 }] });
	});

	t.end();
});
