"use strict";

const util = require("util");
const _ = require("lodash");
const async = require("async");

const api = require("../api");
const Task = require("./task");
const ORGS = require("../../settings").orgs;
const client = require("../db").client;

const INSERT = "INSERT into stargaze (time, username, repo, org) Values ";

function Gazings () {
  Task.apply(this, arguments);
}

util.inherits(Gazings, Task);

Gazings.prototype.type = "Gazings";

Gazings.prototype.run = function (cb) {
  const login = this.data.login;
  api.starings_for_user(login, function (err, res) {
    if (err) {
      return cb(err);
    }
    const gazings = _.chain(res)
      .filter(function(g) {
        return (ORGS.indexOf(g.org) >= 0);
      })
      .map(function (g) {
        return `('${g.time}', '${login}', '${g.repo}', '${g.org}')`;
      })
      .value();

    const partitions = [];
    for (let i=0; i*100<gazings.length; i++) {
      partitions.push(gazings.slice(i * 100, 100 + i * 100));
    }

    async.eachSeries(partitions, function (p, cb) {
      console.log(INSERT + p.join(",\n"));
      client.query(INSERT + p.join(",\n"), cb);
    }, cb);

  });
};

Gazings.prototype.toString = function() {
  return "Task: gazings of " + this.data.login;
};

module.exports = Gazings;