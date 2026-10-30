# State machine monitoring

This guide explains how to use MITI's **State Machine** panel to watch a SMACC2-style state machine or a BehaviorTree.CPP-style behavior tree while the robot runs.

## Overview

The State Machine panel has two tabs:

1. **SMACC2**: the current and previous state, all states, and the transition history
2. **Behavior Tree**: the tree with each node's status, and the tick count

Each tab subscribes to one topic through foxglove_bridge. MITI does not read SMACC2's or BehaviorTree.CPP's own topics directly: a node on the robot publishes a status message with the fields described below.

## Adding the panel

1. Click **Add panel** in the title bar and choose **State Machine**.
2. Select the panel and open **Panel** in the activity bar.
3. Under **General**, set **SMACC2 Status Topic** (default `/smacc2/status`) and **BehaviorTree Status Topic** (default `/behavior_tree/execution_status`). Topic suggestions come from the live topic list.
4. Switch between **SMACC2** and **Behavior Tree** with the tabs at the top of the panel.

## Message format

MITI decodes messages with the definitions foxglove_bridge advertises, so the status topics need a ROS 2 message type that the bridge can load. When foxglove_bridge runs beside MITI (pixi or Docker), add the package to `ros/overlay/src`; see [DEPLOYMENT.md](DEPLOYMENT.md). MITI reads fields by name, so the package and type names are up to you.

Use `float64` for timestamps and 32-bit integers for counts: 64-bit integers (`int64`, `uint64`) arrive in the browser as `BigInt`, which the panel does not convert.

### SMACC2 tab

```
# your_msgs/msg/StateInfo.msg
string name
bool is_active

# your_msgs/msg/Transition.msg
string from_state
string to_state
float64 timestamp            # nanoseconds since the epoch

# your_msgs/msg/StateMachineStatus.msg
string machine_id
string current_state
string previous_state
bool is_running
StateInfo[] states           # optional: shown as chips, active ones highlighted
Transition[] transition_history
```

The panel shows:

- **Machine ID** with a RUNNING or STOPPED badge from `is_running`
- **Current State** and **Previous State**
- **All States**, when `states` is not empty
- **Transition History**, newest first, with the time of each transition
- The time the last message arrived

### Behavior Tree tab

```
# your_msgs/msg/BehaviorTreeStatus.msg
string tree_id
TreeNode root_node
bool is_running
uint32 total_ticks
```

Each node has these fields:

```
string id
string name
string type     # Root, Sequence, Selector, Action, Condition or Decorator (others get a dot)
string status   # IDLE, RUNNING, SUCCESS or FAILURE
<child node type>[] children
```

ROS 2 message types cannot contain themselves, so `children` needs a separate type for each level (for example `TreeNode` with `TreeNodeL1[] children`, `TreeNodeL1` with `TreeNodeL2[] children`). The number of types you define is the deepest level the panel can show.

The panel shows the tree ID, the tick count and a RUNNING or IDLE badge, then the tree with one row per node. Click a node with children to collapse or expand it. Status colors:

- Green: SUCCESS
- Red: FAILURE
- Yellow: RUNNING
- Gray: IDLE

## Example: publishing from a ROS 2 node

```cpp
#include "rclcpp/rclcpp.hpp"
#include "your_msgs/msg/state_machine_status.hpp"

class StateMachineStatusPublisher : public rclcpp::Node {
public:
  StateMachineStatusPublisher() : Node("state_machine_status_publisher") {
    publisher_ = create_publisher<your_msgs::msg::StateMachineStatus>("/smacc2/status", 10);
  }

  void publish_transition(const std::string & from, const std::string & to) {
    your_msgs::msg::Transition transition;
    transition.from_state = from;
    transition.to_state = to;
    transition.timestamp = static_cast<double>(now().nanoseconds());
    history_.push_back(transition);
    if (history_.size() > 50) history_.erase(history_.begin());

    your_msgs::msg::StateMachineStatus msg;
    msg.machine_id = "robot_sm";
    msg.current_state = to;
    msg.previous_state = from;
    msg.is_running = true;
    msg.transition_history = history_;
    publisher_->publish(msg);
  }

private:
  rclcpp::Publisher<your_msgs::msg::StateMachineStatus>::SharedPtr publisher_;
  std::vector<your_msgs::msg::Transition> history_;
};
```

A behavior tree publisher works the same way: build the `BehaviorTreeStatus` message from the tree after each tick (or at a fixed rate) and publish it on `/behavior_tree/execution_status`.

## Troubleshooting

### The panel shows "Not connected to ROS"

MITI is not connected to foxglove_bridge. Check the connection box in the status bar and the bridge address in **Connection settings**.

### The panel shows "Waiting for data..."

1. Check the topic name in the panel settings.
2. Check that the topic is published:
   ```bash
   ros2 topic echo /smacc2/status
   ```
3. Check that the topic appears in the **Topics** view of the activity bar. If it is missing, foxglove_bridge cannot load the message type (install the message package beside the bridge) or its topic whitelist excludes it; the bridge's log says which.

### The panel shows data but fields are empty

Field names must match the ones above exactly. Missing fields are shown as `—`.

### The panel stops updating or shows an error

Check the browser console. A 64-bit integer field (for example `int64 timestamp`) is decoded as `BigInt` and breaks the transition times; use `float64`.

## Performance tips

1. **Keep the history short.** The whole `transition_history` is sent in every message; keep the last few dozen transitions.
2. **Publish only as often as needed.** A state machine changes rarely; publish on each transition, or at a few hertz at most. For behavior trees, 10 Hz is usually enough.
3. **Keep trees small.** Every message carries the full tree; publish the part of the tree you need to watch.

## Not implemented

- Playback of past states
- Export of the history as CSV or JSON
- A drawn state diagram or nested states
- Breakpoints and stepping

## Related documentation

- [README](../README.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
