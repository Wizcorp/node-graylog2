var graylog = require('./graylog'),
    fs = require('fs'),
    file,
    data,
    servers = [
        { 'host': '127.0.0.1', 'port': 12201 }
    ];


var client = new graylog.graylog({
        servers: servers,
        facility: 'Test logger / Node.JS Test Script'
    });

console.log('---------------------------------------------');
console.log('Sending three test as info, warning and error');
console.log('---------------------------------------------');
client.log('test1', 'i get this1', {cool: 'beans'});
client.warn('test2', 'i get this2', {cool: 'beans'});
client.error('test3', 'i get this3', {cool: 'beans'});
client.error('customTime', 'i get this3', {cool: 'beans'}, new Date('2012-10-10 13:20:31.619Z'));
console.log('');

console.log('---------------------------------------------');
console.log('Sending Sean Connery\' picture (as critical)');
console.log('---------------------------------------------');
file = './data/sean.jpg';
data = fs.readFileSync(file);
client.critical('My Nice Sean Connery Picture', data.toString(), {name: 'James Bond'});
console.log('');

console.log('---------------------------------------------');
console.log('Sending data of different sizes (as critical)');
console.log('---------------------------------------------');
for (var i = 4; i <= 128; i *= 2) {
    file = './data/' + i + '.dat';
    data = fs.readFileSync(file);
    console.log('sending', file);
    client.critical('Test 4 ' + file, data.toString(), {datafile: i + '.dat'});
}
console.log('');

console.log('---------------------------------------------');
console.log('Sending different parameters');
console.log('---------------------------------------------');
client.log('ParametersTest - Only short message');
client.log('ParametersTest - Short message and json', {cool: 'beans'});
client.log('ParametersTest - Short message and full message', 'Full message');
client.log('ParametersTest - Short Message with full message and json', 'Full message', {cool: 'beans'});
console.log('');


console.log('Insertion complete. Please check', 'http://' + servers[0].host + ':3000', 'and verify that insertion was successfull');
console.log('');
