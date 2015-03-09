"use strict";

const async = require("async");
const _ = require("lodash");
const log = require("floorine");

const api = require("./api");
const db = require("./db");
const limits = require("./limits");
const Runner = require("./runner");
const settings = require('../settings');

const ORGS = settings.orgs;

function run () {
  if (!ORGS || !ORGS.length) {
    log.error('settings needs an orgs array');
    process.exit(1);
  }
  if (!settings.user && settings.pass) {
    process.exit('settings needs a user and pass');
    process.exit(1);
  }

  const auto = {
    db: function (cb) {
      db.connect(cb)
    },
    my_limits: function (cb) {
      api.get_limit(cb);
    },
    update_limits: ["my_limits", function (cb, res) {
      const my_limits = res.my_limits;
      limits.reset = my_limits.reset;
      limits.remaining = my_limits.remaining;
      limits.limit = my_limits.limit;
      log.log("Github API rate limit: %s/%s until %s", limits.remaining, limits.limit, limits.reset);
      cb();
    }],
    runner: ["update_limits", function (cb, res) {
      const runner = new Runner(res.db);
      runner.run(cb);
    }],
  };

  async.auto(auto, function (err, res) {
    if (err) {
      log.error(err);
      return process.exit(1);
    }
    log.log(res.unique_users);
    log.log("finished", limits.total_reqs, "remaining", limits.remaining);
  });
}

module.exports = {
  run: run,
};