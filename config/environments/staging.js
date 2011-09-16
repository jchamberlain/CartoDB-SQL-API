module.exports.node_port    = 8080;
module.exports.environment  = 'staging';
module.exports.db_base_name = 'cartodb_user_<%= user_id %>_db';
module.exports.db_user      = 'cartodb_user_<%= user_id %>';
module.exports.db_host      = 'localhost';
module.exports.db_port      = '6432';
module.exports.redis_host   = '127.0.0.1';
module.exports.redis_port   = 6379;
module.exports.redisPool    = 50;
module.exports.redisIdleTimeoutMillis   = 10000;
module.exports.redisReapIntervalMillis  = 1000;
module.exports.redisLog     = false;
