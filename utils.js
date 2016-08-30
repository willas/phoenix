var redis = require("redis");
var Promise = require("bluebird");
var config = require('./config');
RDS_PORT = config.redis.port;
RDS_HOST = config.redis.host;
RDS_OPTS = {};
var redisClient = null;

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);
    
if (redisClient == null) {
    redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
    redisClient.on("error", function (err) {
        redisClient = redis.createClient(RDS_PORT, RDS_HOST, RDS_OPTS);
    });
}

function report(data) {
    var multi = redisClient.multi();
    var redis_key = config.queue.report;

    multi.lpush(redis_key, JSON.stringify(data));

    multi.exec(function(err, replices) {
        console.log(replices);
    });
}

exports.reportMatters = function(type, data, currentJob) {


    var message = {};
    message.project     = currentJob.project;
    message.module      = currentJob.module;
    message.type        = type;
    message.url         = currentJob.url;
    message.md5         = currentJob.md5;
    message.time        =  Date.now() / 1000;
    message.data        = data;

    report(message);
}

