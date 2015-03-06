"use strict";

const _ = require("lodash");
const async = require("async");
const url = require('url');
const parse_links = require('parse-link-header');
const auth = require("../settings");

const options = {
  headers: {
    'User-Agent': 'request',
    'Accept': 'application/vnd.github.v3+json'
  },
  auth: auth
};

const request = require("request").defaults(options);

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
      obj[f] = d[f];
    });
    array.push(obj);
  });
}

function recursive_request (root_url, db, base_doc, fields, cb_) {
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
    return cb_(err, data);
  }

  db.find({ url: root_url}, function (err, doc) {
    if (err) {
      console.error(err);
      return cb(err);
    }
    let pages = {};

    if (doc.length) {
      doc = doc[0];
      pages = doc.pages;
    }

    const opts = {url: root_url};

    if (pages[1]) {
      opts.headers = {'If-None-Match': pages[1].etag};
    } else {
      pages[1] = {data: [], etag: null};
    }

    console.log("requesting", opts.url, pages[1] ? pages[1].etag : "uncached");
    request(opts, function (err, res, body) {
      if (err) {
        console.error(err);
        return cb(err);
      }
      if (res.statusCode >= 400) {
        return cb("Error with request: " + root_url + "\n" + body);
      }
      const newEtag = res.headers.etag;
      if (newEtag && newEtag !== pages[1].etag) {
        invalidate = true;
        pages[1].etag = newEtag;
        insert_pluck_(fields, res.body, pages[1].data);
      }

      const link = parse_links(res.headers.link);
      const numPages = (link && parseInt(link.last.page, 10)) || _.size(pages);

      if (numPages === 1 && !invalidate) {
        if (res.statusCode == 304) {
          return cb(null, pages);
        }
        if (!link || !link.next) {
          return cb(null, pages);
        }
      }

      const q = async.queue(function (task, cb) {
        const opts = {url: task.url};
        const page = task.page;
        if (!pages[page]) {
          pages[page] = {etag: null, data: []};
        }
        const etag = pages[page].etag;

        if (etag) {
          opts.headers = {'If-None-Match': etag };
        }

        console.log("requesting ", opts.url, etag);
        request(opts, function (err, res, body) {
          if (err) {
            console.error(err);
            return cb(err);
          }
          if (res.statusCode >= 400) {
            return cb("Error with request: " + root_url + "\n" + body);
          }
          const newEtag = res.headers.etag;
          if (newEtag && newEtag !== etag) {
            console.log("Invalidating cache for", opts.url);
            invalidate = true;
            pages[page].etag = newEtag;
            insert_pluck_(fields, res.body, pages[page].data);
          }
          cb();
        });
      }, 10);

      q.drain = function () {
        if (!invalidate) {
          return cb(null, pages);
        }
        base_doc.url = root_url;
        base_doc.pages = pages;
        db.update({url: root_url}, base_doc, {upsert: true}, function (err, doc) {
          if (err) {
            debugger;
            console.error(err);
          }
          cb(err, pages);
        });
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

recursive_request.request = request;
module.exports = recursive_request;