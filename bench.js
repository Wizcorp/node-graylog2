var Graylog = require('./graylog').graylog;
var fs = require('fs');
var client;
var servers = [
    { 'host': '127.0.0.1', 'port': 12201 }
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
var small = 'h'.repeat(2500);
var big = 'h'.repeat(25000);
var bigRandom = require('crypto').randomBytes(20000).toString('base64');

console.log('');

function log(str, label, i, n, cb) {
    if (i === 0) {
        console.time(label + ' x' + n);
		createClient();
    }

    if (i === n) {
		client.close(function () {
			console.timeEnd(label + ' x' + n);
			cb();
	    });

    } else {
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
    console.log('');
    console.log('Insertion complete. Please check', 'http://' + servers[0].host + ':3000', 'and verify that insertion was successfull');
	console.log('');
}

testSmall(function () {
    testBig(function () {
        testBigAndRandom(end);
    });
});
