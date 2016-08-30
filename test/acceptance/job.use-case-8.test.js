/**
 *
 * Requires the database and tables setup in config/environments/test.js to exist
 * Ensure the user is present in the pgbouncer auth file too
 * TODO: Add OAuth tests.
 *
 * To run this test, ensure that cartodb_test_user_1_db metadata exists
 * in Redis for the vizzuality.cartodb.com domain
 *
 * SELECT 5
 * HSET rails:users:vizzuality id 1
 * HSET rails:users:vizzuality database_name cartodb_test_user_1_db
 *
 */
require('../helper');

var app = require(global.settings.app_root + '/app/app')();
var assert = require('../support/assert');
var redisUtils = require('../support/redis_utils');
var querystring = require('querystring');
var redisConfig = {
    host: global.settings.redis_host,
    port: global.settings.redis_port,
    max: global.settings.redisPool,
    idleTimeoutMillis: global.settings.redisIdleTimeoutMillis,
    reapIntervalMillis: global.settings.redisReapIntervalMillis
};
var metadataBackend = require('cartodb-redis')(redisConfig);
var batchFactory = require('../../batch');

describe('Use case 8: cancel a running multiquery job', function() {
    var batch = batchFactory(metadataBackend, redisConfig);

    before(function (done) {
        batch.start();
        batch.on('ready', done);
    });

    after(function (done) {
        batch.stop();
        redisUtils.clean('batch:*', done);
    });

    var runningJob = {};
    var cancelledJob = {};

    it('Step 1, should create a new multiquery job', function (done) {
        assert.response(app, {
            url: '/api/v2/sql/job?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'POST',
            data: querystring.stringify({
                query: [
                    "select pg_sleep(1)",
                    "select pg_sleep(1)",
                    "select pg_sleep(1)"
                ]
            })
        }, {
            status: 201
        }, function(res) {
            runningJob = JSON.parse(res.body);
            done();
        });
    });

    it('Step 2, multiquery job should be running', function (done){
        var interval = setInterval(function () {
            assert.response(app, {
                url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
                headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
                method: 'GET'
            }, {
                status: 200
            }, function(res) {
                var job = JSON.parse(res.body);
                if (job.status === "running") {
                    clearInterval(interval);
                    done();
                } else if (job.status === "done" || job.status === "failed" || job.status === "cancelled") {
                    clearInterval(interval);
                    done(new Error('Job ' + job.job_id + ' is ' + job.status + ', expected to be running'));
                }
            });
        }, 50);
    });

    it('Step 3, cancel a multiquery job', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 200
        }, function(res) {
            cancelledJob = JSON.parse(res.body);
            assert.equal(cancelledJob.status, "cancelled");
            done();
        });
    });

    it('Step 4, multiquery job should be cancelled', function (done){
        assert.response(app, {
            url: '/api/v2/sql/job/' + runningJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'GET'
        }, {
            status: 200
        }, function(res) {
            var job = JSON.parse(res.body);
            if (job.status === "cancelled") {
                done();
            } else {
                done(new Error('Job status is not cancelled, ' + job.status));
            }
        });
    });

    it('Step 5, cancel a cancelled multiquery job should give an error', function (done) {
        assert.response(app, {
            url: '/api/v2/sql/job/' + cancelledJob.job_id + '?api_key=1234',
            headers: { 'host': 'vizzuality.cartodb.com', 'Content-Type': 'application/x-www-form-urlencoded' },
            method: 'DELETE'
        }, {
            status: 400
        }, function(res) {
            var errors = JSON.parse(res.body);
            assert.equal(errors.error[0], "Cannot set status from cancelled to cancelled");
            done();
        });
    });
});
