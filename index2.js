var phantom = require('phantom');
var fs = require('fs');
var redis = require("redis");
var async = require('async');
var Promise = require("bluebird");
var utils = require('./utils');
var exec = require('child_process').exec;

var config = require('./config');
RDS_PORT = config.redis.port;
RDS_HOST = config.redis.host;
RDS_OPTS = {};

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);


"use strict"; 
if (!Date.prototype.toISOString) {
    Date.prototype.toISOString = function () {
        function pad(n) { return n < 10 ? '0' + n : n; }
        function ms(n) { return n < 10 ? '00'+ n : n < 100 ? '0' + n : n }
        return this.getFullYear() + '-' +
            pad(this.getMonth() + 1) + '-' +
            pad(this.getDate()) + 'T' +
            pad(this.getHours()) + ':' +
            pad(this.getMinutes()) + ':' +
            pad(this.getSeconds()) + '.' +
            ms(this.getMilliseconds()) + 'Z';
    }
}

function createHAR(address, title, startTime, endTime, resources)
{
    var entries = [];

    resources.forEach(function (resource) {
        var request = resource.request,
            startReply = resource.startReply,
            endReply = resource.endReply;

        if (!request || !startReply || !endReply) {
            return;
        }

        // Exclude Data URI from HAR file because
        // they aren't included in specification
        if (request.url.match(/(^data:image\/.*)/i)) {
            return;
	}

        entries.push({
            // startedDateTime: request.time.toISOString(),
            startedDateTime: request.time,
            time: new Date(endReply.time) - new Date(request.time),
            request: {
                method: request.method,
                url: request.url,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: request.headers,
                queryString: [],
                headersSize: -1,
                bodySize: -1
            },
            response: {
                status: endReply.status,
                statusText: endReply.statusText,
                httpVersion: "HTTP/1.1",
                cookies: [],
                headers: endReply.headers,
                redirectURL: "",
                headersSize: -1,
                bodySize: startReply.bodySize,
                content: {
                    size: startReply.bodySize,
                    mimeType: endReply.contentType==null?"":endReply.contentType
                }
            },
            cache: {},
            timings: {
                blocked: 0,
                dns: -1,
                connect: -1,
                send: 0,
                wait: new Date(startReply.time) - new Date(request.time),
                receive: new Date(endReply.time) - new Date(startReply.time),
                ssl: -1
            },
            pageref: address
        });
    });

    return {
        log: {
            version: '1.2',
            creator: {
                name: "PhantomJS",
                version: '2.1.1'
            },
            pages: [{
                startedDateTime: startTime.toISOString(),
                id: address,
                title: title,
                pageTimings: {
                    onLoad: endTime - startTime
                }
            }],
            entries: entries
        }
    };
}


var sitepage = null;
var phInstance = null;
var redisClient = null;
var currentJob  = null;
var harData     = {};
harData.resources = new Array();

// module : speed, conn_error, res_timeout, js_error, page_timeout

function handle_page(url) {
    var t = Date.now();

    console.log('start.....');
    sitepage.open(url)
        .then(status => {
            // success fail
            // 访问失败处理
            if (status == 'fail') {
                throw new TypeError('Connection refused');
            }

            return sitepage.property('content');
        })
    .then(content => {
        var u = Date.now() - t;
        console.log(u);
        
        var data = {};
        data.speed = u;

        // > 300 ms才上报waterfall
        if (u > 300) {
            harData.endTime = new Date();
            harData.title = sitepage.evaluate(function () {
                return document.title;
            });
            harData.title = 'test';
            har = createHAR('test', harData.title, harData.startTime, harData.endTime, harData.resources);
            data.waterfall = JSON.stringify(har);
        }
        
        utils.reportMatters('speed', data, currentJob);
	sitepage.close();
        phInstance.exit();

        setTimeout(init, 1);
    })
    .catch(error => {
        var data = {};
        data.conn_error = error;
        utils.reportMatters('conn_error', data, currentJob);
        console.log('error: ' +error);
        setTimeout(next_page, 1);
    });
}


function init() {
    // if (phInstance == null) {
        phantom.create().then(instance => {
            phInstance = instance;
            instance.createPage().then(page => {
                sitepage = page;
                
                sitepage.on('onLoadStarted', function () {
                    harData.startTime = new Date();
                });
                
                sitepage.on('onResourceRequested', function (req) {
                    harData.resources[req.id] = {
                        request: req,
                        startReply: null,
                        endReply: null
                    }
                });

                sitepage.on('onResourceReceived', function (res) {
                    if (res.stage === 'start') {
                        harData.resources[res.id].startReply = res;
                    }
                    if (res.stage === 'end') {
                        harData.resources[res.id].endReply = res;
                    }
                });

                sitepage.on('onResourceTimeout', function(request) {
                    // console.log('Response (#' + request.id + '): ' + JSON.stringify(request));
                    // var data = {};
                    // data.res_timeout = JSON.stringify(request);
                    // utils.reportMatters('res_timeout', data, currentJob);
                });

                sitepage.on('onError', function(msg, trace) {
                    var msgStack = ['ERROR: ' + msg];

                    if (trace && trace.length) {
                        msgStack.push('TRACE:');
                        trace.forEach(function(t) {
                            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
                        });
                    }
                    
                    // module : speed, conn_error, res_timeout, js_error, page_timeout,res_error
                    var data = {};
                    data.js_error = {};
                    data.js_error.msg = msg;
                    data.js_error.trace = JSON.stringify(trace);
                    utils.reportMatters('js_error', data, currentJob);

                    console.log(msgStack.join('\n'));
                });

                sitepage.on('onResourceError', function(resourceError) {
                    var data = {};
                    data.res_error = JSON.stringify(resourceError);
                    utils.reportMatters('res_error', data, currentJob);
                });

                // unit: 10000ms
                page.setting('resourceTimeout', 10000);
                setTimeout(next_page, 1);
            });
        });
    // }

    if (redisClient == null) {
        redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
        redisClient.on("error", function (err) {
            redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
        });
    }
}

function next_page() {
    getJob().then(function(res) {
        if (res == null || res == '{}') {
            setTimeout(next_page, 100);
            return;
        }

        message = JSON.parse(res);
        currentJob = message;
        address = message.url;
            
        // reset
        harData = {};
        harData.resources = new Array();

        if (!address) {
            sitepage.close();
            phInstance.exit();
        }
        handle_page(address);
    });

}

function getJob() {
    var redis_key = config.queue.jobs;
    return redisClient.rpopAsync(redis_key);
}

init();
