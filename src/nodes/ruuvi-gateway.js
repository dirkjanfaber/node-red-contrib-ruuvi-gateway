const axios = require('axios')
const curlirize = require('axios-curlirize')
const path = require('path')
const packageJson = require(path.join(__dirname, '../../', 'package.json'))

module.exports = function (RED) {
  function RuuviGatewayNode (config) {
    RED.nodes.createNode(this, config)
    this.gateway = RED.nodes.getNode(config.gateway)
    const node = this

    node.on('input', function (msg) {
      const url = msg.url || `http://${node.gateway.host}/history`
      const headers = {
        'User-Agent': 'node-red-contrib-ruuvi-gateway/' + packageJson.version,
        Authorization: `Bearer ${node.gateway.token}`
      }

      axios.get(url, { headers }).then(function (response) {
        msg.payload = response.data.data
        if (config.store_in_global_context === true) {
          const globalContext = node.context().global
          globalContext.set('ruuvi.' + response.data.data.gw_mac, response.data.data)
        }
        msg.topic = response.data.data.gw_mac
        node.status({ fill: 'green', shape: 'ring', text: 'Ok' })
        node.send(msg)
      }).catch(function (error) {
        if (error.response && error.message) {
          node.status({ fill: 'red', shape: 'dot', text: error.message })
        } else {
          node.status({ fill: 'red', shape: 'dot', text: 'Error fetching Ruuvi data' })
        }
      })

      if (config.verbose === true) {
        curlirize(axios, (result, err) => {
          node.warn(result.command)
        })
      }
    })

    node.on('close', function (done) {
      done()
    })
  }
  RED.nodes.registerType('Ruuvi gateway', RuuviGatewayNode)
}
