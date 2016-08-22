var phantom = require('phantom');
var fs = require('fs');
var redis = require("redis");
var async = require('async');
var Promise = require("bluebird");
var request = require('request');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

var redisClient = redis.createClient(6379, '127.0.0.1', {});
redisClient.on("error", function (err) {
    redisClient = redis.createClient(6379, '127.0.0.1', {});
});

var id = 1;
var base_url = 'http://localhost:10001';

function report() {
    var multi = redisClient.multi();
    var redis_key = 'phoenix_report_queue';

    var multi = redisClient.multi();
    multi.lrange(redis_key, 0, -1);
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
        });
        setTimeout(report, 1000);
    });
}

report();
