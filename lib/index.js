"use strict";

const async = require("async");
const _ = require("lodash");
const log = require("floorine");

const api = require("./api");
const init_db = require("./db");
const limits = require("./limits");
const settings = require('../settings');

const ORGS = settings.orgs;

function get_stargazzers_for_org (stargazers_db, org, repos, cb) {
  async.eachLimit(repos, 5, function (repo, limitCB) {
    if (repo.fork) {
      return limitCB();
    }
    log.log("found", org, repo.name);
    api.stargazers_for_repo(stargazers_db, org, repo.name, limitCB);
  }, cb);
}

function select_unique_users (stargazers_db, uniq_users, cb) {
  stargazers_db.find({}, function (err, res) {
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
    return cb(null, uniq_users);
  });
};

function get_gazzings_for_user(starings_db, users_db, username, cb) {
  api.starings_for_user(starings_db, username, function (err, res) {
    if (err) {
      return cb(err);
    }
    const objs = _.chain(res)
      .filter(function(g) {
        return (ORGS.indexOf(g.org) >= 0);
      })
      .map(function (g) {
        g.user = username;
        return g;
      })
      .value();
    users_db.remove({user: username}, {}, function (err) {
      if (err) {
        return cb(err);
      }
      users_db.insert(objs, function (err, doc) {
        return cb(err, objs);
      });
    });
  });
}

function get_all_stargazzers (dbs, repos, cb) {
  const orgs = _.keys(repos);
  async.eachSeries(orgs, function (org, cb) {
    log.log("Finding stargazers for %s's repos", org);
    get_stargazzers_for_org(dbs[org].stargazers, org, repos[org], cb);
  }, cb);
}

function select_all_users(dbs, cb) {
  const users = {};
  const orgs = _.keys(dbs);
  log.log("Calculating unique users who are stargazers");

  async.eachSeries(orgs, function (org, cb) {
    const stargazers = dbs[org].stargazers;
    select_unique_users(stargazers, users, cb);
  }, function (err) {
    const userArray = _.keys(users);
    userArray.sort();
    return cb(err, userArray);
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
    repos: ["db", "my_limits", function (cb, res) {
      const repos = {};
      async.eachSeries(ORGS, function (org, cb) {
        log.log("Finding repos for %s", org);
        repos[org] = [];
        api.repos_for_orgs(res.db[org].repos, org, function (err, res) {
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
    all_stargazzers: ['db', 'repos', function (cb, res) {
      return cb();
      get_all_stargazzers(res.db, res.repos, cb);
    }],
    all_users: ["db", "all_stargazzers", function (cb, res) {
      select_all_users(res.db, cb);
    }],
    gazzings: ["all_users", function (cb, res) {
      const dbs = res.db[ORGS[0]];
      const starings = dbs.starings;
      const users = dbs.users;
      const all_users = res.all_users;
      const numberOfUsers = all_users.length;
      log.log("Found ", numberOfUsers, "unique users");
      let i = 0;
      async.eachSeries(all_users, function (username, cb) {
        log.log("Fetching info for %s: %s/%s.", username, i, numberOfUsers);
        get_gazzings_for_user(starings, users, username, cb);
        i++;
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