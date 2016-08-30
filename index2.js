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


var sitepage = null;
var phInstance = null;
var redisClient = null;
var currentJob  = null;

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
        utils.reportMatters('speed', data, currentJob);
        setTimeout(next_page, 1);
    })
    .catch(error => {
        var data = {};
        data.conn_error = error;
        utils.reportMatters('conn_error', data, currentJob);
        console.log('error: ' +error);
        setTimeout(next_page, 1);
    });
}


function start() {
    if (phInstance == null) {
        phantom.create().then(instance => {
            phInstance = instance;
            instance.createPage().then(page => {
                sitepage = page;

                sitepage.on('onResourceTimeout', function(request) {
                    // console.log('Response (#' + request.id + '): ' + JSON.stringify(request));
                    // var data = {};
                    // data.res_timeout = JSON.stringify(request);
                    // utils.reportMatters('res_timeout', data, currentJob);
                    console.log('ssssssssss');
                    var cmd = '/usr/local/bin/phantomjs ' + currentJob.url + ' ' +  JSON.stringify(currentJob);
                    exec(cmd,function(error, stdout, stderr) {
                        console.log('aasdfas');
                    });
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
    }

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

        console.log(res);
        if (!address) {
            sitepage.close();
            phInstance.exit();
        }
        // setTimeout(next_page, 1);
        handle_page(address);
    });

}

function getJob() {
    var redis_key = config.queue.jobs;
    return redisClient.rpopAsync(redis_key);
}

start();
