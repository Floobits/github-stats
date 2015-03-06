"use strict";

const Datastore = require('nedb');

const db = {};

function make_db (name) {
  if (name in db) {
    return db[name];
  }
  const d = new Datastore({filename: "db/" + name + ".db", autoload: true});
  db[name] = d;
  d.ensureIndex({ fieldName: "url", unique: true}, function (err) {
    if (err) {
      console.error(err);
      return;
    } 
    console.log("created db", name);
  });
  return d;
}

module.exports = make_db;