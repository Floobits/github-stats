"use strict";

const Datastore = require('nedb');
const _ = require("lodash");
const async = require("async");

function make_db_ (org, name, indices, cb) {
  const db_name = org ? org + "-" + name : name;

  var d = new Datastore({filename: "db/" + db_name + ".db"});

  d.loadDatabase(function (err) {
    if (err) {
      return cb(err);
    }
    _.each(indices, function (unique, index) {
      console.log(db_name, index, unique);
      d.ensureIndex({ fieldName: index, unique: unique}, function (err) {
        if (err) {
          console.error(err);
          return cb(err);
        } 
        console.log("created db", db_name);
        cb();
      });
    });
  });
  
  return d;
}

function init (orgs, cb) {
  const DB = {};
  const users = make_db_("", "users", {'user': false}, function(err) {
    if (err) {
      return cb(err);
    }
    
    const stargazers = make_db_("", "starings_for_user", {'url': true}, function (err) {
      if (err) {
        return cb(err);
      }

      async.each(orgs, function (org, cb) {
        DB[org] = {};
        const dbs = [
          ["repos", org, "stargazers_for_repo", {'url': true}], 
          ["starings", org, "repos_for_org", {'url': true}]
        ];
        DB[org].users = users;
        DB[org].stargazers = stargazers;
        async.each(dbs, function (args, cb) {
          const name = args.shift();
          args.push(cb);
          DB[org][name] = make_db_.apply(null, args);
        }, cb);
      }, function (err) {
        cb(err, DB);
      });
    });  
  });
}

module.exports = init;