"use strict";

const util = require("util");

const api = require("../api");
const Task = require("./task");

function Repos () {
  Task.apply(this, arguments);
}

util.inherits(Repos, Task);

Repos.prototype.type = "Repos";

Repos.prototype.run = function (cb) {
  const org = this.data.org;
  api.repos_for_orgs(org, function (err, res) {
    if (err) {
      return cb(err);
    }
    const newTasks = res.map(function (repo) {
      repo.org = org;
      return repo;
    }).filter(function (repo) {
      return !repo.fork;
    });

    return cb(null, newTasks);
  });
};

module.exports = Repos;