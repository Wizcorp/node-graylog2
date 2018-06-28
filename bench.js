var Graylog = require('.').graylog;
var client;
var servers = [
    { host: '127.0.0.1', port: 12201 }
];

function createClient() {
	client = new Graylog({
	    servers: servers,
	    facility: 'node-graylog benchmark'
	});

	client.on('error', function (error) {
		throw error;
	});
}


var i = 0;
var count = 20000;
var small = 'h'.repeat(1000);
var big = 'h'.repeat(25000);
var bigRandom = require('crypto').randomBytes(20000).toString('base64');

console.log('');

function log(str, label, i, n, cb) {
    if (i === 0) {
        createClient();
        console.time(label + ' x' + n);

        client.on('drain', function () {
            console.timeEnd(label + ' x' + n);

            console.log('Sent:', client.sent, '- Compressed:', client.compressed);
            console.log('');

            if (client.sent !== n) {
                throw new Error('Should have sent: ' + n);
            }

            cb();
        });
    }

    if (i < n) {
        client.log('test', str);
        process.nextTick(log, str, label, i + 1, n, cb);
    }
}

function testSmall(cb) {
    log(small, 'small', 0, 10000, cb);
}

function testBig(cb) {
    log(big, 'big', 0, 5000, cb);
}

function testBigAndRandom(cb) {
    log(bigRandom, 'bigAndRandom', 0, 2000, cb);
}

function end() {
    console.log('Complete.');
    console.log('Please check your logging service and verify that insertion was successful.');
    console.log('');
}

testSmall(function () {
    testBig(function () {
        testBigAndRandom(end);
    });
});
