"use strict";

const log = require("floorine");
const _ = require("lodash");
const pg = require("pg");
const async = require("async");

const settings = require("../settings").db;
const client = new pg.Client(`postgres://${settings.user}:${settings.pass}@localhost/${settings.name}`);

const TABLES = [
  `create table if not exists tasks (
      id serial primary key,
      type varchar(15) NOT NULL,
      completed boolean DEFAULT FALSE,
      data text NOT NULL,
      created timestamp DEFAULT current_timestamp,
      unique(data, type)
    );
  `,
  `create table if not exists stargaze (
      time timestamp NOT NULL,
      username text NOT NULL,
      repo text NOT NULL,
      org text NOT NULL,
      unique(username, org, repo)
    );
  `
];

function connect (cb) {
  log.log("Initializing databases...");
  const auto = {
    pg: function (cb) {
      client.connect(cb);
    },
    tables: ["pg", function (cb) {
      async.each(TABLES, function (t, cb) {
        client.query(t, cb);
      }, cb)
    }],
    index: ["tables", function (cb) {
      client.query("create index on tasks completed;", function (err) {
        cb();
      });
    }],
  };
  async.auto(auto, function (err, res) {
    return cb(err, client);
  });
}

module.exports = {connect: connect, client: client};