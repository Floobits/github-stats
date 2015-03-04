"use strict";
const request = require("request");
const auth = require("../settings");
const async = require("async");
const _ = require("lodash");
const url = require('url');
const parse_links = require('parse-link-header');

var options = {
    headers: {
        'User-Agent': 'request',
        'Accept': 'application/vnd.github.v3.star+json'
    },
    auth: auth
};

function make_opts (url) {
  return _.merge({url: url}, options);
}

function handle_res (cb, err, res, body) {
  if (err) {
    return cb(err);
  }
  body = JSON.parse(body);
  return follow_links(body, res, cb);
}

function stargazers (org, repo, cb) {
  const opts = make_opts(`https://api.github.com/repos/${org}/${repo}/stargazers`);
  request(opts, handle_res.bind(null, cb));
}

function follow_links (data, res, cb) {
  const link = parse_links(res.headers.link);

  if (!link.next) {
    return cb();
  }

  const q = async.queue(function (task, cb) {
    request(make_opts(task.url), function (err, res, body) {
      if (err) {
        console.error(err);
        return cb(err);
      }
      data = data.concat.apply(data, JSON.parse(body));
      cb();
    });
  }, 10);

  const numPages = parseInt(link.last.page, 10);
  const query = url.parse(link.last.url, true);
  
  delete query.search;
  delete query.path;
  for (let i=2; i<=numPages; i++) {
    query.query.page = i;
    q.push({url: url.format(query)});
  }
  q.drain = function () {
    cb(null, data);
  };
}

function starred (org, repo, user, cb) {
  const url = `${user.url}/starred`;
  const opts = make_opts(url);
  request(opts, function (err, res, body) {
    follow_links(JSON.parse(body), res, cb)
  });
}

function star_graph (org, repo) {
  const auto = {
    stargazers: stargazers.bind(null, org, repo),
    graph: ["stargazers", function (cb, res) {
      starred(org, repo, res.stargazers[0], cb);
    }],
    reduced: ["graph", function (cb, res) {
      return cb(null, res.graph.map(function (d) {
        return {
          time: d.starred_at,
          repo: d.repo.full_name
        }
      }));
    }]
  };

  async.auto(auto, function (err, res) {
    console.log(err, res.reduced);
  });
}

module.exports = {
  run: function () {
    star_graph("Floobits", "floobits-sublime", console.log);
  }
}