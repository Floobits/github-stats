"use strict";

const async = require("async");
const _ = require("lodash");
const request = require("request");

const recursive_request = require("./request");
const make_db = require("./db");
const settings = require("../settings");

function stargazers (dbs, org, repo, cb) {
  const url = `https://api.github.com/repos/${org}/${repo}/stargazers`;
  recursive_request(url, dbs.stargazers, {org: org, repo: repo}, ["login"], function (err, res) {
    console.log(res.length ? "found " + res.length : "no", "stargazers for", org, repo);
    return cb(err, res);
  });
}

function starings (dbs, user, cb) {
  const url = `https://api.github.com/users/${user}/starred`;
  const fields = [{time: "starred_at"}, {repo: ['repo','name']}, {org: ['repo','owner','login']}];
  const reqOptions = {headers: {Accept: "application/vnd.github.v3.star+json"}};
  recursive_request(url, dbs.starings, {user: user}, fields, reqOptions, cb);
}

function repos_for_orgs (dbs, org, cb) {
  const url = `https://api.github.com/orgs/${org}/repos`;
  recursive_request(url, dbs.repos, {org: org}, ['name', 'fork'], cb);
}

function get_limit (cb) {
  const opts = {
    auth: settings,
    url: "https://api.github.com/users/whatever", 
    headers: {
      'User-Agent': 'request',
      'Accept': 'application/vnd.github.v3+json',
      "If-None-Match": '"40680bb1e5f5ebc9fd0f070b104a5887"'
    }
  };
  
  request(opts, function (err, res, body) {
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
  get_limit: get_limit,
};