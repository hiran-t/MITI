// A stand-in foxglove_bridge that publishes a simulated SMACC2 state machine and behavior tree,
// with the message definitions from docs/STATE_MACHINE_MONITORING.md, for documentation screenshots.
//   NODE_PATH=<MITI>/node_modules node sm-bridge.cjs [port]
const { WebSocketServer } = require('ws');
const { FoxgloveServer } = require('@foxglove/ws-protocol');
const { parse } = require('@foxglove/rosmsg');
const { MessageWriter, MessageReader } = require('@foxglove/rosmsg2-serialization');
const port = Number(process.argv[2] ?? 8799);
const SEP = '\n================================================================================\n';

const SM_SCHEMA = [
  'string machine_id\nstring current_state\nstring previous_state\nbool is_running\nmiti_demo_msgs/StateInfo[] states\nmiti_demo_msgs/Transition[] transition_history',
  'MSG: miti_demo_msgs/StateInfo\nstring name\nbool is_active',
  'MSG: miti_demo_msgs/Transition\nstring from_state\nstring to_state\nfloat64 timestamp',
].join(SEP);
const node = (name, child) => `MSG: miti_demo_msgs/${name}\nstring id\nstring name\nstring type\nstring status` + (child ? `\nmiti_demo_msgs/${child}[] children` : '');
const BT_SCHEMA = [
  'string tree_id\nmiti_demo_msgs/TreeNode root_node\nbool is_running\nuint32 total_ticks',
  node('TreeNode', 'TreeNodeL1'), node('TreeNodeL1', 'TreeNodeL2'), node('TreeNodeL2', 'TreeNodeL3'), node('TreeNodeL3'),
].join(SEP);
const smWriter = new MessageWriter(parse(SM_SCHEMA, { ros2: true }));
const btWriter = new MessageWriter(parse(BT_SCHEMA, { ros2: true }));

// SMACC2: a pick-and-place cycle, one transition every 2 s.
const STATES = ['Idle', 'NavigateToShelf', 'DetectObject', 'GraspObject', 'NavigateToDropoff', 'PlaceObject'];
let current = 0;
const history = [];
function smMessage() {
  return {
    machine_id: 'pick_and_place_sm',
    current_state: STATES[current],
    previous_state: history.length ? history[history.length - 1].from_state : '',
    is_running: true,
    states: STATES.map((name, i) => ({ name, is_active: i === current })),
    transition_history: history,
  };
}
function advance() {
  const next = (current + 1) % STATES.length;
  history.push({ from_state: STATES[current], to_state: STATES[next], timestamp: Date.now() * 1e6 });
  if (history.length > 12) history.shift();
  current = next;
}
for (let i = 0; i < 9; i++) advance(); // start with some history

// Behavior tree: a patrol tree whose nodes move through IDLE → RUNNING → SUCCESS.
let ticks = 1520;
const n = (id, name, type, status, children = []) => ({ id, name, type, status, children });
function btMessage() {
  const step = Math.floor(ticks / 4) % 6;
  const s = (from, to) => (step < from ? 'IDLE' : step < to ? 'RUNNING' : 'SUCCESS');
  return {
    tree_id: 'patrol_bt',
    is_running: true,
    total_ticks: ticks,
    root_node: n('0', 'Root', 'Root', 'RUNNING', [
      n('1', 'PatrolLoop', 'Sequence', 'RUNNING', [
        n('2', 'BatteryOK', 'Condition', 'SUCCESS', []),
        n('3', 'GoToWaypoint', 'Selector', step < 4 ? 'RUNNING' : 'SUCCESS', [
          n('4', 'ComputePathToPose', 'Action', s(0, 1), []),
          n('5', 'FollowPath', 'Action', s(1, 4), []),
          n('6', 'ClearCostmap', 'Action', 'IDLE', []),
        ]),
        n('7', 'RetryUntilDocked', 'Decorator', step < 4 ? 'IDLE' : step < 5 ? 'RUNNING' : 'SUCCESS', [
          n('8', 'DockCheck', 'Action', step < 4 ? 'IDLE' : step < 5 ? 'FAILURE' : 'SUCCESS', []),
        ]),
        n('9', 'ReportStatus', 'Action', step < 5 ? 'IDLE' : 'RUNNING', []),
      ]),
    ]),
  };
}

// Check that both definitions round-trip before serving them.
for (const [schema, msg] of [[SM_SCHEMA, smMessage()], [BT_SCHEMA, btMessage()]]) {
  const bytes = new MessageWriter(parse(schema, { ros2: true })).writeMessage(msg);
  const back = new MessageReader(parse(schema, { ros2: true })).readMessage(bytes);
  if (JSON.stringify(back).length < 50) throw new Error('round trip failed');
}

const server = new FoxgloveServer({ name: 'miti-demo-state-machine', capabilities: [], supportedEncodings: ['cdr'], metadata: { ROS_DISTRO: 'jazzy' } });
const sm = server.addChannel({ topic: '/smacc2/status', encoding: 'cdr', schemaName: 'miti_demo_msgs/msg/StateMachineStatus', schema: SM_SCHEMA, schemaEncoding: 'ros2msg' });
const bt = server.addChannel({ topic: '/behavior_tree/execution_status', encoding: 'cdr', schemaName: 'miti_demo_msgs/msg/BehaviorTreeStatus', schema: BT_SCHEMA, schemaEncoding: 'ros2msg' });
const wss = new WebSocketServer({ port, host: '127.0.0.1', handleProtocols: (protocols) => server.handleProtocols(protocols) });
wss.on('connection', (conn, req) => server.handleConnection(conn, `${req.socket.remoteAddress}:${req.socket.remotePort}`));
const stamp = () => BigInt(Date.now()) * 1_000_000n;
setInterval(() => server.sendMessage(sm, stamp(), smWriter.writeMessage(smMessage())), 500);
setInterval(() => { ticks += 1; server.sendMessage(bt, stamp(), btWriter.writeMessage(btMessage())); }, 250);
setInterval(advance, 2000);
console.log(`stand-in bridge on ws://127.0.0.1:${port}`);
