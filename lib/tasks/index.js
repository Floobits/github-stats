const repos = require("./repos");
const stargazers = require("./stargazers");
const gazings = require("./gazings");

module.exports = {
  tasks: {
    Repos: repos,
    Stargazers: stargazers,
    Gazings: gazings,
    Bootstrap: require("./bootstrap")
  },
  state_machine: {
    Bootstrap: repos,
    Repos: stargazers,
    Stargazers: gazings,
  }
};