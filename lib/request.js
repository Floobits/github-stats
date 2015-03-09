"use strict";

const url = require('url');

const _ = require("lodash");
const async = require("async");
const log = require("floorine");
const parse_links = require('parse-link-header');
const request = require("request");

const limits = require("./limits");
const auth = require("../settings");

function insert_pluck_ (fields, string, array) {
  let flatten = false;
  if (fields.length === 1) {
    flatten = fields[0];
  }
  JSON.parse(string).forEach(function (d) {
    if (flatten) {
      array.push(d[flatten]);
      return;
    }
    let obj = {};

    fields.forEach(function (f) {
      if (typeof f === "string") {
        obj[f] = d[f];
        return;
      }

      _.each(f, function (v, k) {
        if (typeof v === "string") {
          obj[k] = d[v];
          return;
        }
        let node = d;
        for (let i=0; i<v.length; i++) {
          node = node[v[i]];
        }
        obj[k] = node;
      });
    });
    array.push(obj);
  });
}

function rate_limited_request (opts, cb, retries_) {
  retries_ = retries_ || 1;
  if (retries_ > 10) {
    return cb("Too many retries for ", opts.url);
  }
  limits.remaining -= 1;
  request(opts, function (err, res, body) {
    // cached contents
    // if (res.statusCode === 304) {
    //   limits.remaining += 1;
    //   return cb(err, res, body);
    // }
    if (res.statusCode >= 400) {
      return cb("Error with request: " + opts.url + "\n" + body);
    }
    // anything but a ratelimited
    if (res.statusCode !== 403) {
      return cb(err, res, body);
    }

    // rate limited
    const headers = res.headers;
    limits.remaining = parseInt(headers['x-ratelimit-remaining'], 10);
    limits.reset = new Date(headers['x-ratelimit-reset'] * 1000);
    // the difference can be negative and there can be clock skew
    const timeout = Math.max(limits.reset - Date.now(), 0) + 10000;
    const message = JSON.parse(body).message;
    log.error("OH NOES: %s (%s)", message, opts.url);
    log.error("Will resume in ~%s minutes", parseInt((timeout / 1000)/60));
    setTimeout(function () {
      rate_limited_request(opts, cb, retries_+1);
    }, timeout);
  });
}

function recursive_request (root_url, fields, options, cb_) {
  if (!cb_) {
    cb_ = options;
    options = {};
  }

  const data = [];

  const cb = function (err) {
    return cb_(err, data);
  }

  const opts = _.merge({}, {
    headers: {
      'User-Agent': 'request',
      'Accept': 'application/vnd.github.v3+json'
    },
    auth: auth,
    url: root_url
  }, options);

  log.log("requesting", opts.url);

  limits.total_reqs += 1;
  rate_limited_request(opts, function (err, res, body) {
    if (err) {
      log.error(err);
      return cb(err);
    }

    const link = parse_links(res.headers.link);
    const numPages = link ? parseInt(link.last.page, 10) : 1;

    if (numPages === 1) {
      insert_pluck_(fields, body, data);
      cb();
    }

    const q = async.queue(function (task, cb) {
      const opts = _.merge({}, {
        headers: {
          'User-Agent': 'request',
          'Accept': 'application/vnd.github.v3+json'
        },
        auth: auth,
        url: task.url
      }, options);

      log.log("requesting", opts.url);
      limits.total_reqs += 1;
      rate_limited_request(opts, function (innerError, innerRes, innerBody) {
        if (innerError) {
          log.error(innerError);
          return cb(innerError);
        }
        insert_pluck_(fields, innerBody, data);
        cb();
      });
    }, 20);

    q.drain = cb;
    
    const query = url.parse(root_url, true);
    delete query.search;
    delete query.path;

    for (let i=2; i<=numPages; i++) {
      query.query.page = i;
      q.push({url: url.format(query), page: i});
    }
  });
}

module.exports = recursive_request;