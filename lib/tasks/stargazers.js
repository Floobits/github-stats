"use strict";

const util = require("util");

const api = require("../api");
const Task = require("./task");

function Stargazers () {
  Task.apply(this, arguments);
}

util.inherits(Stargazers, Task);

Stargazers.prototype.type = "Stargazers";

Stargazers.prototype.run = function (cb) {
  api.stargazers_for_repo(this.data.org, this.data.repo, function (err, res) {
    if (err) {
      return cb(err);
    }
    res = res || [];
    return cb(err, res.map(function (username) {
      return {login: username};
    }));
  });
};

Stargazers.prototype.toString = function() {
  return "Task: gazers of " + this.data.org + "/" + this.data.repo;
};

module.exports = Stargazers;