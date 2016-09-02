var phantom = require('phantom');
var fs = require('fs');
var redis = require("redis");
var async = require('async');
var Promise = require("bluebird");
var request = require('request');

var config = require('./config');
RDS_PORT = config.redis.port;
RDS_HOST = config.redis.host;
RDS_OPTS = {};

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
redisClient.on("error", function (err) {
    redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
});

var base_url = config.remote;

function report() {
    var multi = redisClient.multi();
    var redis_key = config.queue.report;

    var multi = redisClient.multi();
    multi.lrange(redis_key, 0, 10);
    // remove all
    multi.del(redis_key);

    multi.exec(function(err, replices) {
        console.log(replices[0]);
        if (replices[0].length == 0) {
            setTimeout(report, 1000);
            return;
        }
        var url = base_url + '/api/v1/page/report';
        var data = {
            'metrics' : JSON.stringify(replices[0])
        };

        request.post({
            url: url, 
            formData: data
        }, function (err, httpResponse, body) {
            if (err) {
                return console.error('upload failed:', err);
            }
            console.log('Upload successful!  Server responded with:', body);
            setTimeout(report, 1);
        });

    });
}

report();
