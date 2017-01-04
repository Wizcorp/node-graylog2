var graylog = require('./graylog');
var fs  = require('fs');
var servers = [
    { 'host': '127.0.0.1', 'port': 12201 }
];

var client = new graylog.graylog({
    servers: servers,
    facility: 'node-graylog benchmark'
});


console.log('Deflate:', client.deflate);
console.log('');

console.time('small message');

var i = 0;
var count = 20000;
var small = 'h'.repeat(2500);
var big = 'h'.repeat(25000);
var bigRandom = require('crypto').randomBytes(20000).toString('base64');


function log(str, label, i, n, cb) {
    if (i === 0) {
        console.time(label + ' x' + n);
    }

    if (i === n) {
        console.timeEnd(label + ' x' + n);
        cb();
    } else {
        client.log('test', str);
        setImmediate(log, str, label, i + 1, n, cb);
    }
}

function testSmall(cb) {
    log(small, 'small', 0, 20000, cb);
}

function testBig(cb) {
    log(big, 'big', 0, 10000, cb);
}

function testBigAndRandom(cb) {
    log(bigRandom, 'bigAndRandom', 0, 10000, cb);
}

function close() {
    client.close(function () {
        console.log('');
        console.log('Insertion complete. Please check', 'http://' + servers[0].host + ':3000', 'and verify that insertion was successfull');
    });
}

testSmall(function () {
    testBig(function () {
        testBigAndRandom(close);
    });
});

