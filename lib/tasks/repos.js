"use strict";

const util = require("util");

const api = require("../api");
const Task = require("./task");

function RepoTask (id, data) {
  this.id = id;
  this.org = data.org;
  Task.apply(this, arguments);
}

util.inherits(RepoTask, Task);

RepoTask.prototype.type = "repo";

RepoTask.prototype.run = function (cb) {
  api.repos_for_orgs(this.org, function (err, res) {
    if (err) {
      return cb(err);
    }
    const newTasks = res.map(function (repo) {
      return {repo: repo, org: org};
    })
    return cb(null, newTasks);
  });
};

module.exports = RepoTask;