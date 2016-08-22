var phantom = require('phantom');
var fs = require('fs');
var redis = require("redis");
var async = require('async');
var Promise = require("bluebird");
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
        // console.log(content);
        // fs.write('/tmp/phantomjs.log', u + "\n", 'a+');
        var u = Date.now() - t;
        console.log(u);
        var data = {};
        data.speed = u;
        reportMatters('speed', data);

        setTimeout(next_page, 1);
    })
    .catch(error => {
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
                    console.log('Response (#' + request.id + '): ' + JSON.stringify(request));
                });

                sitepage.on('onError', function(msg, trace) {
                    var msgStack = ['ERROR: ' + msg];

                    if (trace && trace.length) {
                        msgStack.push('TRACE:');
                        trace.forEach(function(t) {
                            msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function +'")' : ''));
                        });
                    }

                    console.log(msgStack.join('\n'));
                });

                sitepage.on('onResourceError', function(resourceError) {
                    // console.log('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                    // console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
                });

                    // unit: ms
                    page.setting('resourceTimeout', 7000)

                    setTimeout(next_page, 1);
                });
        });
    }

    if (redisClient == null) {
        redisClient = redis.createClient(6379, '127.0.0.1', {});
        redisClient.on("error", function (err) {
            redisClient = redis.createClient(6379, '127.0.0.1', {});
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
    var redis_key = 'phoenix_agent_jobs_queue';
    return redisClient.rpopAsync(redis_key);
}

function reportQalarm(module, code, message) {
    var message = {};
    message.type        = 'qalarm';
    message.project     = 'phoenix';
    message.module      = module;
    message.code        = code;
    message.env         = 'prod';
    message.time        =  Date.now() / 1000;
    message.server_ip   =  '';
    message.client_ip   =  '';
    message.script      = '';
    message.message     = message;

    report(message);
}

function reportMatters(module, data) {
    var message = {};
    message.project     = currentJob.project;
    message.module      = module;
    message.url         = currentJob.url;
    message.md5         = currentJob.md5;
    message.time        =  Date.now() / 1000;
    message.data        = data;

    report(message);
}

function report(data) {
    var multi = redisClient.multi();
    var redis_key = 'phoenix_report_queue';

    multi.lpush(redis_key, JSON.stringify(data));

    multi.exec(function(err, replices) {
        console.log(replices);
    });
}

function isNullObject(obj){
    for(var p in obj){
        if(obj.hasOwnProperty(p)){
            return false;  //有自有属性或方法，返回false
        }
    }
    return true;  //没有自有属性或方法，返回true，该对象是空对象
}

start();
