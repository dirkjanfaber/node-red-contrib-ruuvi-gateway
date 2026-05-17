import helper = require('node-red-node-test-helper');
import ruuviGatewayNode = require('../nodes/ruuvi-gateway');
import configRuuviGatewayNode = require('../nodes/config-ruuvi-gateway');
import axios from 'axios';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('axios-curlirize', () => jest.fn());

helper.init(require.resolve('node-red'));

const MOCK_DATA = {
  gw_mac: 'AA:BB:CC:DD:EE:FF',
  tags: { tag1: { temperature: 22.5 } },
  timestamp: '2024-01-01T00:00:00Z',
};

const BASE_FLOW = (overrides: Record<string, unknown> = {}) => [
  {
    id: 'config1',
    type: 'config-ruuvi-gateway',
    name: 'Test Gateway',
    host: 'ruuvigateway1234.local',
    token: 'test-token',
  },
  {
    id: 'n1',
    type: 'Ruuvi gateway',
    name: 'test ruuvi',
    gateway: 'config1',
    store_in_global_context: false,
    verbose: false,
    wires: [['n2']],
    ...overrides,
  },
  { id: 'n2', type: 'helper' },
];

describe('config-ruuvi-gateway node', () => {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(() => helper.stopServer(done));
  });

  it('loads without error', async () => {
    const flow = [{ id: 'c1', type: 'config-ruuvi-gateway', name: 'gw', host: 'host.local', token: 'tok' }];
    await helper.load(configRuuviGatewayNode, flow);
    const c1 = helper.getNode('c1');
    expect(c1).toBeDefined();
  });

  it('exposes host and token properties', async () => {
    const flow = [{ id: 'c1', type: 'config-ruuvi-gateway', name: 'gw', host: 'myhost.local', token: 'mytoken' }];
    await helper.load(configRuuviGatewayNode, flow);
    const c1 = helper.getNode('c1');
    expect(c1['host']).toBe('myhost.local');
    expect(c1['token']).toBe('mytoken');
  });
});

describe('ruuvi-gateway node', () => {
  let mockedGet: jest.Mock;

  beforeEach(function (done) {
    mockedGet = axios.get as jest.Mock;
    mockedGet.mockResolvedValue({ data: { data: MOCK_DATA } });
    helper.startServer(done);
  });

  afterEach(function (done) {
    jest.clearAllMocks();
    helper.unload().then(() => helper.stopServer(done));
  });

  describe('basic behaviour', () => {
    it('loads without error', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');
      expect(n1).toBeDefined();
    });

    it('makes a GET request to the gateway history URL on input', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({});
      });

      expect(mockedGet).toHaveBeenCalledWith(
        'http://ruuvigateway1234.local/history',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('uses msg.url when provided instead of the gateway host', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({ url: 'http://custom-host/history' });
      });

      expect(mockedGet).toHaveBeenCalledWith(
        'http://custom-host/history',
        expect.anything()
      );
    });

    it('includes the package version in the User-Agent header', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({});
      });

      expect(mockedGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringMatching(/^node-red-contrib-ruuvi-gateway\//),
          }),
        })
      );
    });
  });

  describe('successful response', () => {
    it('sets msg.payload to the gateway data', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      const msg = await new Promise<Record<string, unknown>>(resolve => {
        helper.getNode('n2').on('input', resolve);
        n1.receive({});
      });

      expect(msg['payload']).toEqual(MOCK_DATA);
    });

    it('sets msg.topic to the gateway MAC address', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      const msg = await new Promise<Record<string, unknown>>(resolve => {
        helper.getNode('n2').on('input', resolve);
        n1.receive({});
      });

      expect(msg['topic']).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('sets node status to green on success', async () => {
      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');
      const statusSpy = jest.spyOn(n1 as unknown as { status: () => void }, 'status');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({});
      });

      expect(statusSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ fill: 'green', shape: 'ring' })
      );
    });

    it('stores data in global context when store_in_global_context is true', async () => {
      await helper.load(
        [configRuuviGatewayNode, ruuviGatewayNode],
        BASE_FLOW({ store_in_global_context: true })
      );
      const n1 = helper.getNode('n1');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({});
      });

      const globalCtx = (n1 as unknown as { context(): { global: { get(k: string): unknown } } }).context().global;
      expect(globalCtx.get('ruuvi.AA:BB:CC:DD:EE:FF')).toEqual(MOCK_DATA);
    });

    it('does not store data in global context when store_in_global_context is false', async () => {
      await helper.load(
        [configRuuviGatewayNode, ruuviGatewayNode],
        BASE_FLOW({ store_in_global_context: false })
      );
      const n1 = helper.getNode('n1');

      await new Promise<void>(resolve => {
        helper.getNode('n2').on('input', () => resolve());
        n1.receive({});
      });

      const globalCtx = (n1 as unknown as { context(): { global: { get(k: string): unknown } } }).context().global;
      expect(globalCtx.get('ruuvi.AA:BB:CC:DD:EE:FF')).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('sets status to red with error message when response and message are present', async () => {
      mockedGet.mockRejectedValue({ response: { status: 401 }, message: 'Unauthorized' });

      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');
      const statusSpy = jest.spyOn(n1 as unknown as { status: () => void }, 'status');

      await new Promise<void>(resolve => {
        n1.receive({});
        setTimeout(resolve, 50);
      });

      expect(statusSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ fill: 'red', shape: 'dot', text: 'Unauthorized' })
      );
    });

    it('sets generic error status when error has no response', async () => {
      mockedGet.mockRejectedValue({ message: 'Network Error' });

      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');
      const statusSpy = jest.spyOn(n1 as unknown as { status: () => void }, 'status');

      await new Promise<void>(resolve => {
        n1.receive({});
        setTimeout(resolve, 50);
      });

      expect(statusSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ fill: 'red', shape: 'dot', text: 'Error fetching Ruuvi data' })
      );
    });

    it('does not send a message on error', async () => {
      mockedGet.mockRejectedValue({ message: 'fail' });

      await helper.load([configRuuviGatewayNode, ruuviGatewayNode], BASE_FLOW());
      const n1 = helper.getNode('n1');

      let received = false;
      helper.getNode('n2').on('input', () => { received = true; });
      n1.receive({});

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(received).toBe(false);
    });
  });
});
