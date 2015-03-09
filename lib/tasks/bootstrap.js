"use static";
const util = require("util");
const _ = require("lodash");

const orgs = require("../../settings").orgs;
const client = require("../db").client;
const Task = require("./task");

function Bootstrap () {
  Task.apply(this);
  this.id = -2;
}

util.inherits(Bootstrap, Task);

Bootstrap.prototype.type = "Bootstrap";

Bootstrap.prototype.run = function(cb) {
  client.query("select * from tasks where type='repo';", function (err, rows) {
    if (err) {
      return cb(err);
    }
    const orgsInDb = rows.rows.map(function (r) {return r.data});
    const newOrgs = _.difference(orgs, orgsInDb).map(function (org) {
      return {org: org};
    });
    return cb(null, newOrgs);
  });
};

module.exports = Bootstrap;