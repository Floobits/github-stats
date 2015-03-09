const api = require("../api");

function Task (id, data) {
  this.id = id;
  this.data = data;
}

Task.prototype.run = function(cb) {
  api.repos_for_orgs(res.db[org].repos, org, function (err, res) {
    if (err) {
      return cb(err);
    }
    log.log("Found %s repos", res.length);
    repos[org].push.apply(repos[org], res);
    cb();
  });
};

Task.prototype.complete = function (db, cb) {
  db.query({text: "UPDATE tasks set completed='t' where id=$1", values: [this.id]}, cb);
};

Task.prototype.store = function (db) {
  // todo ignore integrity constraint, assert no id
  debugger;
  const query = {
    text: "INSERT into tasks (type, data)  values ($1, $2)", 
    values: [this.type, JSON.stringify(this.data)]
  };

  db.query(query, function (err, res) {
    debugger;
    // get id
    [err, res];
  });
};

Task.prototype.toString = function() {
  return "Task: " + this.type + " " + this.data;
};

module.exports = Task;