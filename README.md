# node-graylog2

Graylog2 client library for Node.js, based on node-graylog. This
has been heavily modified to the point where there is not much left
of the original; however, this library should still be compatible
with the old one, except for configuration and the GLOBAL function setup
(some optional arguments in logging calls are not supported; they will be
logged as additional data).

** New: ** Chunked [GELF](https://github.com/Graylog2/graylog2-docs/wiki/GELF)
is now supported.

## Synopsis

### Available functions

* graylog.emergency
* graylog.alert
* graylog.critical
* graylog.error
* graylog.warning
* graylog.notice
* graylog.info
* graylog.debug

### Code snippets

```javascript
var graylog2 = require("graylog2");
var logger = new graylog2.graylog({
    servers: [
        { 'host': 127.0.0.1, port: 12201 },
        { 'host': 127.0.0.2, port: 12201 }
    ],
    hostname: 'server.name', // the name of this host
                             // (optional, default: os.hostname())
    facility: 'Node.js',     // the facility for these log messages
                             // (optional, default: "Node.js")
    bufferSize: 1350         // max UDP packet size, should never exceed the
                             // MTU of your system (optional, default: 1400)
});

logger.on('error', function (error) {
    console.error('Error while trying to write to graylog2:', error);
});
```

Short message:

```javascript
logger.log("What we've got here is...failure to communicate");
```

Long message:

```javascript
logger.log("What we've got here is...failure to communicate", "Some men you just
    can't reach. So you get what we had here last week, which is the way he wants
    it... well, he gets it. I don't like it any more than you men.");
```

Short with additional data:

```javascript
logger.log("What we've got here is...failure to communicate", { cool: 'beans' });
```

Long with additional data:

```javascript
logger.log("What we've got here is...failure to communicate", "Some men you just
    can't reach. So you get what we had here last week, which is the way he wants
    it... well, he gets it. I don't like it any more than you men.",
    {
        cool: "beans"
    }
);
```

## Example

See `test.js`.

## What is graylog2 after all?

It's a miracle. Get it at http://www.graylog2.org/

## Installation

    npm install graylog2

## License

See LICENSE file. Basically, it's a kind of "do-whatever-you-want-for-free" license.

## Original author

Egor Egorov <me@egorfine.com>

