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
  this.q = async.queue(this.queue.bind(this), 5);
  this.q.empty = this.get_task.bind(this);
  this.q.drain = cb;
  this.q.push(new tasks.Bootstrap());
};

Runner.prototype.queue = function (task, cb) {
  log.log("Running %s", task.toString());

  if (!task.id) {
    debugger;
  }

  if (task.id in this.tasks) {
    log.error('already running task', task.id);
    return cb();
  }

  this.tasks[task.id] = task;
  const that = this;
  log.log("running", task.toString());
  task.run(function (err, newTasksData) {
    if (err) {
      console.error(err.message ? err.message : err);
      return cb(err);
    }
    
    task.complete(that.db, function (err) {
      delete that.tasks[task.id];
      if (err) {
        console.log(err);
        return cb(err);
      }

      if (!newTasksData || !newTasksData.length) {
        return cb();
      }

      const type = state_machine[task.type];
      if (!type) {
        return cb();
      }

      async.each(newTasksData, function (taskData, cb) {
        const newTask = new type(null, taskData);
        newTask.store(that.db, function (err) {
          if (err) {
            return cb(err);
          }
          if (that.q.length() < 30) {
            that.q.push(newTask);
          }
          cb();
        });
      }, cb);
    });
  });
};

Runner.prototype.get_task = function () {
  const that = this;
  const value = (_.size(this.tasks) ? _.keys(this.tasks) : [-1]).join(", ");
  const query = `select * from tasks where completed=false and id not in (${value}) limit 10;`;

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
      const task = new type(row.id, JSON.parse(row.data));
      that.q.push(task);
    });
  });
};

module.exports = Runner;