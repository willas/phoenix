var _ = require('underscore');
var path = require('path');
var default_config = require('./env.json'); //加载默认共享配置

//自启动匿名函数
module.exports = (function () {
    var version = (process.env.NODE_ENV||'development').toLowerCase(), ver_config, config;
    
    config = _.extend({'version':version}, default_config, ver_config);
    return config;
})();
