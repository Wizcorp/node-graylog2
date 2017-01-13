var test = require('tape');
var Graylog = require('..');

test('levels', function (t) {
	var client = new Graylog({ servers: [{ host: '127.0.0.1', port: 12345 }] });

	var levels = {
		debug: 7,
		info: 6,
		notice: 5,
		warning: 4,
		error: 3,
		critical: 2,
		alert: 1,
		emergency: 0
	};

	var levelNames = Object.keys(levels);
	var cursor = 0;  // traverses over levelNames

	client.on('message', function (message) {
		message = JSON.parse(message);

		var expectedLevelName = levelNames[cursor];
		var expectedLevel = levels[expectedLevelName];

		t.equal(message.short_message, 'short message for level ' + expectedLevelName);
		t.equal(message.level, expectedLevel);

		cursor += 1;

		if (cursor === levelNames.length) {
			t.end();
		}
	});

	for (var i = 0; i < levelNames.length; i += 1) {
		var level = levelNames[i];
		client[level]('short message for level ' + level);
	}
});
