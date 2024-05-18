module.exports = function (RED) {
  'use strict'
  function ConfigRuuviGateway (n) {
    RED.nodes.createNode(this, n)
    this.name = n.name
    this.host = n.host
    this.token = n.token
  }
  RED.nodes.registerType('config-ruuvi-gateway', ConfigRuuviGateway)
}
