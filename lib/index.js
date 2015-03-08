"use strict";

const async = require("async");
const _ = require("lodash");
const log = require("floorine");

const api = require("./api");
const init_db = require("./db");
const limits = require("./limits");
const settings = require('../settings');

const ORGS = settings.orgs;

function stargazzers_for_org (db, org, repos, cb) {
  async.eachLimit(repos, 5, function (repo, limitCB) {
    if (repo.fork) {
      return limitCB();
    }
    log.log("found", org, repo.name);
    api.stargazers_for_repo(db, org, repo.name, limitCB);
  }, cb);
}

function unique_users (stargazers, uniq_users, cb) {
  stargazers.find({}, function (err, res) {
    log.log("found", _.size(res), "repos");
    _.each(res, function (repo) {
      const numberOfPages = _.size(repo.pages);
      let count = 0;
      for (let i=1; i<=numberOfPages; i++) {
        const data = repo.pages[i].data;
        for (let j=0; j<=data.length; j++) {
          uniq_users[data[j]] = true;
          count += 1;
        }
      }
      log.log(repo.org, repo.repo, count);
    });
    log.log(_.size(uniq_users));
    return cb(null, uniq_users);
  });

};

function gazzings_for_user(dbs, user, cb) {
  api.starings_for_user(dbs, user, function (err, res) {
    if (err) {
      return cb(err);
    }
    const objs = _.chain(res)
      .filter(function(g) {
        return (ORGS.indexOf(g.org) >= 0);
      })
      .map(function (g) {
        g.user = user;
        return g;
      })
      .value();
    dbs.users.remove({user: user}, {}, function (err) {
      if (err) {
        return cb(err);
      }
      dbs.users.insert(objs, function (err, doc) {
        return cb(err, objs);
      });
    });
  });
}

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
      init_db(ORGS, cb)
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
    repos: ["db", "update_limits", function (cb, res) {
      const repos = {};
      async.eachSeries(ORGS, function (org, cb) {
        log.log("Finding repos for %s", org);
        repos[org] = [];
        api.repos_for_orgs(res.db[org], org, function (err, res) {
          if (err) {
            return cb(err);
          }
          log.log("Found %s repos", res.length);
          repos[org].push.apply(repos[org], res);
          cb();
        });
      }, function (err) {
        return cb(err, repos);
      });
    }],
    // get the logins of active stargazzers for each repo
    stargazers: ["repos", function (cb, res) {
      async.eachSeries(ORGS, function (org, cb) {
        log.log("Finding stargazers for %s's repos", org);
        stargazzers_for_org(res.db[org], org, res.repos[org], cb);
      }, cb);
    }],
    unique_users: ["stargazers", function (cb, res) {
      const users = {};
      log.log("Calculating unique users who are stargazers");
      async.eachSeries(ORGS, function (org, cb) {
        const stargazers = res.db[org].stargazers;
        unique_users(stargazers, users, cb);
      }, function (err) {
        const userArray = _.keys(users);
        userArray.sort();
        return cb(err, userArray);
      });
    }],
    gazzings: ["unique_users", function (cb, res) {
      const dbs = res.db[ORGS[0]];
      log.log("Found ", res.unique_users.length, "unique users");
      async.eachSeries(res.unique_users, function (username, cb) {
        gazzings_for_user(dbs, username, cb);
      }, cb);
    }]
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