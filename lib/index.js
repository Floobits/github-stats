"use strict";

const async = require("async");
const _ = require("lodash");
const recursive_request = require("./request");
const make_db = require("./db");
const settings = require("../settings");

function stargazers (org, repo, cb) {
  const db = make_db("stargazers");
  const url = `https://api.github.com/repos/${org}/${repo}/stargazers`;
  recursive_request(url, db, {org: org, repo: repo}, ["login"], function (err, res) {
    console.log("found ", res.length, "stargazers for ", org, repo);
    return cb(err, res);
  });
}

function starred (org, repo, user, cb) {
  const url = `${user.url}/starred`;
  const opts = make_opts(url);
  request(opts, function (err, res, body) {
    follow_links(JSON.parse(body), res, cb);
  });
}

function repos_for_orgs (org, cb) {
  const db = make_db("repos");
  const url = `https://api.github.com/orgs/${org}/repos`;
  recursive_request(url, db, {org: org}, ['name', 'fork'], cb);
}

function get_limit (cb) {
  recursive_request.request({url: "https://api.github.com/users/whatever"}, function (err, res, body) {
    const headers = res.headers;
    const reset = new Date(headers['x-ratelimit-reset'] * 1000);
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    return cb(err, {remaining: remaining, reset: reset});
 }); 
}
// phase 1: get users
// phase 2: get starred for users
//  record last time something was starred
// phase 3: record starred stuffs

const ORGS = ["atom", "Floobits"];

function run () {
  let limits = null;
  get_limit(function (err, d) {
    limits = d;
    console.log(d);
  });
  async.eachSeries(ORGS, function (org, seriesCB) {
    console.log(org);
    repos_for_orgs(org, function (err, res) {
      if (err) {
        return seriesCB(err);
      }
      console.log("found ", res.length, "repos!");
      async.eachLimit(res, 10, function (repo, limitCB) {
        if (repo.fork) {
          return;
        }
        console.log("found ", org, repo.name);
        stargazers(org, repo.name, limitCB);
      }, seriesCB);
    });
  }, function (err) {
    if (err) {
      console.log("error:", err);
      process.exit(1);
    } else {
      console.log("all done");
    }
  });
}

module.exports = {
  run: run,
};