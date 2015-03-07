"use strict";

const url = require('url');

const _ = require("lodash");
const async = require("async");
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

function recursive_request (root_url, db, base_doc, fields, options, cb_) {
  if (!cb_) {
    cb_ = options;
    options = {};
  }

  let invalidate = false;

  const cb = function (err, pages) {
    if (err) {
      return cb_(err);
    }

    const data = [];
    _.each(pages, function (page, num) {
      _.each(page.data, function (pageData) {
        data.push(pageData);
      });
    });

    if (!invalidate) {
      return cb_(null, data);
    }

    base_doc.url = root_url;
    base_doc.pages = pages;

    db.update({url: root_url}, base_doc, {upsert: true}, function (err, doc) {
      if (err) {
        console.error(err);
      }
      cb_(err, data);
    });
  }

  db.findOne({ url: root_url}, function (err, doc) {
    if (err) {
      console.error(err);
      return cb(err);
    }

    let rootEtag = null;
    let pages;

    if (doc) {
      pages = doc.pages;
      rootEtag = pages[1].etag;
    } else {
      pages = {1: {data: [], etag: null}};
    }

    const opts = _.merge({}, {
      headers: {
        'User-Agent': 'request',
        'Accept': 'application/vnd.github.v3+json'
      },
      auth: auth,
      url: root_url
    }, options);

    if (rootEtag) {
      opts.headers['If-None-Match'] = rootEtag;
    }

    console.log("requesting", opts.url, rootEtag ? rootEtag.split('"')[1] : "uncached");

    limits.total_reqs += 1;
    request(opts, function (err, res, body) {
      if (err) {
        console.error(err);
        return cb(err);
      }
      if (res.statusCode >= 400) {
        return cb("Error with request: " + root_url + "\n" + body);
      }

      const newEtag = res.headers.etag;
      if (res.statusCode !== 304) {
        invalidate = true;
        console.log("Invalidating cache for", opts.url, res.headers['x-ratelimit-remaining']);
        pages[1].etag = newEtag;
        insert_pluck_(fields, res.body, pages[1].data);
      }

      const link = parse_links(res.headers.link);
      const numPages = (link && parseInt(link.last.page, 10)) || _.size(pages);

      if (numPages === 1) {
        return cb(null, pages);
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

        const page = task.page;
        if (!pages[page]) {
          pages[page] = {etag: null, data: []};
        }
        const etag = pages[page].etag;

        if (etag) {
          opts.headers['If-None-Match'] = etag;
        }

        console.log("requesting", opts.url, etag ? etag.split('"')[1] : "uncached");
        limits.total_reqs += 1;
        request(opts, function (innerError, innerRes, innerBody) {
          if (innerError) {
            console.error(innerError);
            return cb(innerError);
          }
          if (innerRes.statusCode >= 400) {
            innerError = "Error with request: " + root_url + "\n" + innerBody;
            console.error(innerError);
            return cb(innerError);
          }

          const newEtag = innerRes.headers.etag;
          if (innerRes.statusCode !== 304) {
            console.log("Invalidating cache for", opts.url, innerRes.headers['x-ratelimit-remaining']);
            invalidate = true;
            pages[page].etag = newEtag;
            insert_pluck_(fields, innerBody, pages[page].data);
          }
          cb();
        });
      }, 20);

      q.drain = function () {
        cb(err, pages);
      };
      
      const query = url.parse(root_url, true);
      delete query.search;
      delete query.path;

      for (let i=2; i<=numPages; i++) {
        query.query.page = i;
        q.push({url: url.format(query), page: i});
      }
    });
  });
}

module.exports = recursive_request;