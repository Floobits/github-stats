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
    console.log(res.length ? "found " + res.length : "no", "stargazers for", org, repo);
    return cb(err, res);
  });
}

function starings (user, cb) {
  const url = `https://api.github.com/users/${user}/starred`;
  const db = make_db("starings");
  const fields = [{time: "starred_at"}, {repo: ['repo','name']}, {org: ['repo','owner','login']}];
  const reqOptions = {headers: {Accept: "application/vnd.github.v3.star+json"}};
  recursive_request(url, db, {user: user}, fields, reqOptions, cb);
}

function repos_for_orgs (org, cb) {
  const db = make_db("repos");
  const url = `https://api.github.com/orgs/${org}/repos`;
  recursive_request(url, db, {org: org}, ['name', 'fork'], cb);
}

function get_limit (cb) {
  const opts = {
    auth: settings,
    url: "https://api.github.com/users/whatever", 
    headers: {
      'User-Agent': 'request',
      'Accept': 'application/vnd.github.v3+json',
      "If-None-Match": "baaaf623a412d81ca795070a49216c09"
    }
  };

  recursive_request.request(opts, function (err, res, body) {
    const headers = res.headers;
    const reset = new Date(headers['x-ratelimit-reset'] * 1000);
    const remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    return cb(err, {remaining: remaining, reset: reset});
 }); 
}

module.exports = {
  stargazers: stargazers,
  starings: starings,
  repos_for_orgs: repos_for_orgs,
  get_limit: get_limit
};