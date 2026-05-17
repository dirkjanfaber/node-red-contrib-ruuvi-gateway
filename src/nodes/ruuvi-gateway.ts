import type NodeRed from 'node-red';
import { NodeDef, Node } from '@node-red/registry';
import axios from 'axios';
import * as path from 'path';

type NodeAPI = NodeRed.NodeAPI;

interface RuuviGatewayConfig extends NodeDef {
  gateway: string;
  store_in_global_context?: boolean;
  verbose?: boolean;
}

interface ConfigRuuviGatewayNode extends Node {
  host: string;
  token: string;
}

interface RuuviGatewayNode extends Node {
  gateway: ConfigRuuviGatewayNode | null;
}

interface GatewayData {
  gw_mac: string;
  [key: string]: unknown;
}

function ruuviGatewayModule(RED: NodeAPI): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const packageJson = require(path.join(__dirname, '../../', 'package.json')) as { version: string };

  function RuuviGatewayNode(
    this: RuuviGatewayNode,
    config: RuuviGatewayConfig
  ) {
    RED.nodes.createNode(this, config);
    this.gateway = RED.nodes.getNode(config.gateway) as ConfigRuuviGatewayNode | null;
    const node = this;

    node.on('input', function (msg: Record<string, unknown>) {
      const url = (msg['url'] as string | undefined) ?? `http://${node.gateway?.host}/history`;
      const headers = {
        'User-Agent': `node-red-contrib-ruuvi-gateway/${packageJson.version}`,
        Authorization: `Bearer ${node.gateway?.token}`,
      };

      axios.get(url, { headers }).then(function (response) {
        const data = response.data.data as GatewayData;
        msg['payload'] = data;
        if (config.store_in_global_context === true) {
          node.context().global.set(`ruuvi.${data.gw_mac}`, data);
        }
        msg['topic'] = data.gw_mac;
        node.status({ fill: 'green', shape: 'ring', text: 'Ok' });
        node.send(msg);
      }).catch(function (error: { response?: unknown; message?: string }) {
        if (error.response && error.message) {
          node.status({ fill: 'red', shape: 'dot', text: error.message });
        } else {
          node.status({ fill: 'red', shape: 'dot', text: 'Error fetching Ruuvi data' });
        }
      });

      if (config.verbose === true) {
        const headerStr = Object.entries(headers)
          .map(([k, v]) => `-H "${k}: ${v}"`)
          .join(' ');
        node.warn(`curl ${headerStr} "${url}"`);
      }
    });

    node.on('close', function (done: () => void) {
      done();
    });
  }

  RED.nodes.registerType('Ruuvi gateway', RuuviGatewayNode as never);
}

export = ruuviGatewayModule;
