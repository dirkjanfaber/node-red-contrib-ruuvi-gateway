import type NodeRed from 'node-red';
import { NodeDef, Node } from '@node-red/registry';

type NodeAPI = NodeRed.NodeAPI;

interface ConfigRuuviGatewayNodeDef extends NodeDef {
  host: string;
  token: string;
}

interface ConfigRuuviGatewayNode extends Node {
  name: string;
  host: string;
  token: string;
}

function configRuuviGatewayModule(RED: NodeAPI): void {
  function ConfigRuuviGateway(
    this: ConfigRuuviGatewayNode,
    n: ConfigRuuviGatewayNodeDef
  ) {
    RED.nodes.createNode(this, n);
    this.name = n.name;
    this.host = n.host;
    this.token = n.token;
  }
  RED.nodes.registerType('config-ruuvi-gateway', ConfigRuuviGateway as never);
}

export = configRuuviGatewayModule;
