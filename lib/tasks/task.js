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
  db.query({text: "UPDATE tasks SET completed='t' WHERE id=$1", values: [this.id]}, function(err, res) {
    cb(err);
  });
};

Task.prototype.store = function (db, cb) {
  // todo ignore integrity constraint, assert no id
  const query = {
    text: "INSERT INTO tasks (type, data) VALUES ($1, $2) RETURNING id;", 
    values: [this.type, JSON.stringify(this.data)]
  };
  const that = this;
  db.query(query, function (err, res) {
    if (!err) {
      that.id = res.rows[0].id;
      return cb();
    }

    if (err.message !== 'duplicate key value violates unique constraint "tasks_data_type_key"') {
      return cb(err);
    }

    const select = {
      text: "select id from tasks where type=$1 and data=$2;",
      values: [that.type, JSON.stringify(that.data)]
    };

    db.query(select, function (err, row) {
      that.id = row.rows[0].id;
      cb(err);
    });
  });
};

Task.prototype.toString = function() {
  return "Task: " + this.type + " " + JSON.stringify(this.data);
};

module.exports = Task;