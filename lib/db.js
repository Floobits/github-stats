"use strict";

const Datastore = require('nedb');
const log = require("floorine");
const _ = require("lodash");
const async = require("async");

function make_db_ (org, name, indices, cb) {
  if (_.size(indices) > 1) {
    return cb("not support! Too many indices");
  }
  const db_name = org ? org + "-" + name : name;
  const d = new Datastore({filename: "db/" + db_name + ".db"});
  d.loadDatabase(function (err) {
    if (err) {
      return cb(err);
    }
    _.each(indices, function (unique, index) {
      d.ensureIndex({ fieldName: index, unique: unique}, function (err) {
        return cb(err, d);
      });
    });
  });
  return d;
}

function init (orgs, cb) {
  log.log("Initializing databases...");
  const DB = {};
  const auto = {
    users: function (cb_user) {
      make_db_("", "users", {'user': false}, cb_user);
    },
    stargazers: function (cb_stargazers){
      make_db_("", "starings_for_user", {'url': true}, cb_stargazers);
    },
    dbs_for_orgs: ['users', 'stargazers', function (cb_dbs_for_orgs, res) {
      const users = res.users;
      const stargazers = res.stargazers;

      async.each(orgs, function (org, cb_each_org) {
        DB[org] = {users: users, stargazers: stargazers};

        const dbs_for_orgs = [
          ["repos", org, "stargazers_for_repo", {'url': true}], 
          ["starings", org, "repos_for_org", {'url': true}]
        ];

        async.each(dbs_for_orgs, function (args, cb_inner) {
          const name = args.shift();
          args.push(cb_inner);
          DB[org][name] = make_db_.apply(null, args);
        }, cb_each_org);

      }, cb_dbs_for_orgs);
    }]
  };
  async.auto(auto, function (err, res) {
    return cb(err, DB);
  });
}

module.exports = init;