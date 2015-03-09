"use strict";

const util = require("util");
const _ = require("lodash");

const api = require("../api");
const Task = require("./task");
const ORGS = require("../../settings").orgs;
const client = require("../db").client;

function Gazing () {
  Task.apply(this, arguments);
}

util.inherits(Gazing, Task);

Gazing.prototype.type = "gazings";

Gazing.prototype.run = function (cb) {
  api.starings_for_user(this.data, function (err, res) {
    if (err) {
      return cb(err);
    }
    const objs = _.chain(res)
      .filter(function(g) {
        return (ORGS.indexOf(g.org) >= 0);
      })
      .map(function (g) {
        debugger;
        g.user = username;
        return g;
      })
      .value();
    debugger;

  });
};

module.exports = Gazing;