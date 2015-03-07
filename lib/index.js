"use strict";

const async = require("async");
const _ = require("lodash");
const api = require("./api");
const make_db = require("./db");


// phase 1: get users
// phase 2: get starred for users
//  record last time something was starred
// phase 3: record starred stuffs

const ORGS = ["Floobits", "atom"];

function stargazzers_for_org (org, cb) {
  api.repos_for_orgs(org, function (err, res) {
    if (err) {
      return cb(err);
    }
    console.log("found ", res.length, "repos!");
    console.log(res);
    async.eachLimit(res, 5, function (repo, limitCB) {
      if (repo.fork) {
        return limitCB();
      }
      console.log("found ", org, repo.name);
      api.stargazers(org, repo.name, limitCB);
    }, cb);
  });
}

function unique_users (cb) {
  const db = make_db("stargazers");
  db.find({}, function (err, res) {
    const uniq = {};
    console.log("found", _.size(res), "repos");
    _.each(res, function (repo) {
      const numberOfPages = _.size(repo.pages);
      let count = 0;
      for (let i=1; i<=numberOfPages; i++) {
        const data = repo.pages[i].data;
        for (let j=0; j<=data.length; j++) {
          uniq[data[j]] = true;
          count += 1;
        }
      }
      console.log(repo.org, repo.repo, count);
    });
    console.log(_.size(uniq));
    return cb(null, uniq);
  });

};

function gazzings_for_user(user, cb) {
  const gazzings = make_db("gazzings", 'user', false);
  api.starings(user, function (err, res) {
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
    gazzings.remove({user: user}, {}, function (err) {
      if (err) {
        return cb(err);
      }
      gazzings.insert(objs, function (err, doc) {
        return cb(err, objs);
      });
    });
  });
}

function run () {
  // return gazzer_timeline(function (uniq) {
  //   const a = uniq[0];

  return gazzings_for_user("ggreer", function (err, objs) {
    console.log(err, objs);
  });
  
  async.eachSeries(ORGS, function (org, cb) {
    console.log(org);
    stargazzers_for_org(org, cb);
  }, function (err) {
    if (err) {
      console.log("error:", err);
      return process.exit(1);
    }
    console.log("done");
  });
}

module.exports = {
  run: run,
};