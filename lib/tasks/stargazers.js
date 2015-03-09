"use strict";

const util = require("util");

const api = require("../api");
const Task = require("./task");

function Stargazers () {
  Task.apply(this, arguments);
}

util.inherits(Stargazers, Task);

Stargazers.prototype.type = "stargazers";

Stargazers.prototype.run = function (cb) {
  api.stargazers_for_repo(this.data.org, this.data.repo, cb);
};

module.exports = Stargazers;