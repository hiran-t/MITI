# State Machine Monitoring Guide

This guide explains how to use MITI's state machine monitoring features to visualize SMACC2 state machines and BehaviorTree.CPP execution in real-time.

## Overview

MITI provides two monitoring modes:

1. **SMACC2 State Machine Monitor** - Visualize SMACC2 state transitions and current state
2. **BehaviorTree Monitor** - Monitor behavior tree execution and node status

## SMACC2 State Machine Monitoring

### Setup

1. Ensure your SMACC2 state machine publishes status to a ROS2 topic
2. Topic should follow this message structure:

```typescript
interface SMACC2StateMachineStatus {
  machine_id: string
  current_state: string
  previous_state?: string
  timestamp: int64
  is_running: bool
  states: SMACC2State[]
  transition_history: SMACC2Transition[]
}
```

### Usage

1. Open MITI dashboard
2. Add a new "State Machine Monitor" widget
3. Select "SMACC2" tab
4. Enter your state machine topic (default: `/smacc2/status`)
5. Monitor real-time state transitions

### Features

- **State Diagram**: Visual representation of current and previous states
- **State Information**: Current state, running status, message count
- **Transition History**: Log of recent state transitions with timestamps

## BehaviorTree Monitoring

### Setup

1. Ensure your BehaviorTree publishes status to a ROS2 topic
2. Topics should follow these message structures:

**Tree Structure Topic** (`/behavior_tree/tree_structure`):
```typescript
interface BehaviorTreeNode {
  id: string
  name: string
  type: NodeType // Root, Sequence, Selector, Action, etc.
  status: NodeStatus // IDLE, RUNNING, SUCCESS, FAILURE
  children?: BehaviorTreeNode[]
}
```

**Execution Status Topic** (`/behavior_tree/execution_status`):
```typescript
interface BehaviorTreeStatus {
  tree_id: string
  root_node: BehaviorTreeNode
  current_executions: BehaviorTreeExecutionInfo[]
  execution_history: BehaviorTreeExecutionInfo[]
  is_running: bool
  total_ticks: int32
  timestamp: int64
}
```

### Usage

1. Open MITI dashboard
2. Add a new "State Machine Monitor" widget
3. Select "Behavior Tree" tab
4. Enter your tree status topic (default: `/behavior_tree/execution_status`)
5. Enter your tree structure topic (default: `/behavior_tree/tree_structure`)
6. Monitor tree execution

### Features

- **Tree Visualization**: Hierarchical tree structure with node status
- **Status Indicators**:
  - 🟢 Green = SUCCESS
  - 🔴 Red = FAILURE
  - 🟡 Yellow = RUNNING
  - ⚪ Gray = IDLE
- **Statistics**: Total ticks, running nodes, last update time
- **Execution Log**: History of node executions

## Custom Topic Mapping

You can configure custom topic names:

### SMACC2
- Status topic: Customize in monitor settings

### BehaviorTree
- Status topic: Customize in monitor settings
- Structure topic: Customize in monitor settings

## Example: Publishing from ROS2 Package

### SMACC2 Example
```cpp
#include "rclcpp/rclcpp.hpp"
#include "your_msgs/SMACC2StateMachineStatus.hpp"

class SMACCPublisher : public rclcpp::Node {
public:
  SMACCPublisher() : Node("smacc_status_publisher") {
    publisher_ = this->create_publisher<your_msgs::SMACC2StateMachineStatus>(
      "/smacc2/status", 10);
    
    // Publish state machine status
    auto msg = your_msgs::SMACC2StateMachineStatus();
    msg.machine_id = "robot_sm";
    msg.current_state = "State1";
    msg.timestamp = this->now().nanoseconds();
    msg.is_running = true;
    
    publisher_->publish(msg);
  }

private:
  rclcpp::Publisher<your_msgs::SMACC2StateMachineStatus>::SharedPtr publisher_;
};
```

### BehaviorTree Example
```cpp
#include "rclcpp/rclcpp.hpp"
#include "your_msgs/BehaviorTreeStatus.hpp"

class TreeStatusPublisher : public rclcpp::Node {
public:
  TreeStatusPublisher() : Node("tree_status_publisher") {
    publisher_ = this->create_publisher<your_msgs::BehaviorTreeStatus>(
      "/behavior_tree/execution_status", 10);
  }

private:
  rclcpp::Publisher<your_msgs::BehaviorTreeStatus>::SharedPtr publisher_;
};
```

## Troubleshooting

### Monitor shows "Waiting for data..."

1. Verify topic names are correct
2. Check that the ROS2 node is publishing to the topic:
   ```bash
   ros2 topic echo /smacc2/status
   ```
3. Verify WebSocket connection is active

### Message rate is slow

- Increase publishing frequency in your ROS2 node
- Check network latency
- Monitor browser console for errors

### Visualizations not updating

- Verify message structure matches expected interface
- Check that all required fields are populated
- Try reconnecting to rosbridge

## Widget Configuration

The State Machine Monitor widget is registered as:
- **Type**: `state_machine`
- **Default Size**: 6×4 (width × height)
- **Available Modes**: SMACC2, BehaviorTree

### Adding to Dashboard

Click the "+" button → Select "State Machine" → Configure topic names

## Performance Tips

1. **Reduce history size** - Only keep recent transitions/executions
2. **Throttle publish rate** - Don't publish more than 10Hz if not needed
3. **Optimize visualization** - Limit tree depth visualization to 5 levels

## Future Enhancements

- [ ] State machine history playback
- [ ] Export logs as CSV/JSON
- [ ] Custom state diagrams
- [ ] Nested state visualization
- [ ] Breakpoint and stepping (debugging)
- [ ] Performance profiling

## Related Documentation

- [Widget System](./WIDGETS.md)
- [ROS2 Integration](./ROS2_INTEGRATION.md)
- [Customization Guide](./CUSTOMIZATION.md)
