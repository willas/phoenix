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

function fetchJobs() {
    var url = base_url + '/api/v1/page/jobs';
    var formData = [];

    request.post({url: url, formData: formData}, function (err, httpResponse, body) {
        if (err) {
            return console.error('upload failed:', err);
        }

        var result = JSON.parse(body);
        var data = result.data;
        console.log(data);
        data.forEach(function(item) {
            dispatchJob(JSON.stringify(item));
        });
        setTimeout(fetchJobs, 1000);
    });


}

function dispatchJob(message) {
    var multi = redisClient.multi();
    var redis_key = 'phoenix_agent_jobs_queue';
    multi.lpush(redis_key, message);
    multi.exec(function(err, replices) {
    });
}

fetchJobs();
