"use strict";
const async = require("async");
const _ = require("lodash");

const log = require("floorine");
const tasks_ = require("./tasks");

const tasks = tasks_.tasks;
const state_machine = tasks_.state_machine;


function Runner (db) {
  this.db = db;
  this.tasks = {};
  this.q = null;
}

Runner.prototype.run = function (cb) {
  this.q = async.queue(this.queue.bind(this), 20);
  this.q.empty = this.get_task.bind(this);
  this.q.drain = cb;
  this.q.push(new tasks.Bootstrap());
};

Runner.prototype.queue = function (task, cb) {
  log.log("Running %s", task.toString());

  this.tasks[task.id] = task;
  const that = this;
  task.run(function (err, newTasks) {
    if (err) {
      console.error(err);
      return cb(err);
    }
    
    task.complete(that.db, function (err) {
      delete that.tasks[task.id];
      if (err) {
        console.log(err);
        return cb(err);
      }

      if (!newTasks || !newTasks.length) {
        return cb();
      }

      debugger;

      const type = state_machine[task.type];

      async.each(newTasks, function (newTask, cb) {
        const t = new type(null, newTask);
        t.store(cb);
      }, cb);
    });
  });
};

Runner.prototype.get_task = function () {
  const query = {
    text: "select * from tasks where completed='f' and id not in ($1) limit 10;",
    values: [_.size(this.tasks) ? _.keys(this.tasks) : -1],
  };
  console.log(query);
  this.db.query(query, function (err, res) {
    if (err) {
      log.error(err);
      return;
    }
    _.each(res.rows, function (row) {
      const type = tasks[row.type];
      if (!type) {
        log.error("no type " + type);
        return;
      }
      if (row.id in this.tasks) {
        log.error('already running task', row.id);
        return;
      }
      const task = type(row.id, JSON.parse(row.data));
      this.q.push(task);
    });
  });
};

module.exports = Runner;