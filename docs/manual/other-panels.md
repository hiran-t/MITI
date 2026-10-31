# Log, state machines and controls

## Log

The Log panel shows the robot's log messages from `/rosout`. Each node's name gets its own color, so messages from different nodes are easy to tell apart.

```{figure} images/log.webp
:alt: The Log panel with messages from /rosout, and its General and Display settings in the sidebar

The Log panel and its settings.
```

Topic, Log level
: The log topic, usually `/rosout`, and the lowest level to show, from **DEBUG** to **FATAL**.

Namespaces
: Show or hide the messages of single nodes.

Display
: Font size, and whether each line shows its level, date, time, time zone, node name and source location.

**Filter messages** at the top shows only lines that contain the text you type. The buttons next to it copy the shown messages and clear the panel. When you scroll up, new messages keep arriving below; **Latest** jumps back to them.

## Point Cloud

The Point Cloud panel shows one `sensor_msgs/msg/PointCloud2` topic on its own. Choose it in **Point Cloud Topic**; the panel waits until the first cloud arrives. To see a cloud together with the robot model and other topics, turn it on in the {doc}`3D Scene <3d-scene>` instead.

```{figure} images/pointcloud.webp
:alt: The Point Cloud panel showing 14,892 lidar points from /livox/lidar

The Point Cloud panel with `/livox/lidar`.
```

## State Machine

The State Machine panel follows a running state machine or behavior tree. Set the two status topics under **General**, then switch between the tabs at the top of the panel.

### SMACC2

The **SMACC2** tab reads the status of a [SMACC2](https://github.com/robosoft-ai/SMACC2) state machine from **SMACC2 Status Topic** (default `/smacc2/status`). It shows:

- the machine's ID, with **RUNNING** or **STOPPED**
- the **Current State** and the **Previous State**
- **All States**, with the current one highlighted
- the **Transition History**, newest first, with the time of each transition
- the time the last status arrived, at the bottom

```{figure} images/sm-smacc2.webp
:alt: The SMACC2 tab showing machine pick_and_place_sm running, current state GraspObject, previous state DetectObject, all six states and twelve transitions with their times

A pick-and-place state machine in the SMACC2 tab.
```

### Behavior Tree

The **Behavior Tree** tab reads a BehaviorTree.CPP tree's execution from **BehaviorTree Status Topic** (default `/behavior_tree/execution_status`). It shows the tree's ID, how many times it has ticked and whether it runs, then one row per node with its type and status:

| Color  | Status  |
| ------ | ------- |
| Green  | SUCCESS |
| Red    | FAILURE |
| Yellow | RUNNING |
| Gray   | IDLE    |

Click a node that has children to collapse or expand it.

```{figure} images/sm-behavior-tree.webp
:alt: The Behavior Tree tab showing tree patrol_bt running with 1811 ticks, and nodes Root, PatrolLoop, BatteryOK, GoToWaypoint, ComputePathToPose, FollowPath, ClearCostmap, RetryUntilDocked, DockCheck and ReportStatus with their statuses

A patrol behavior tree in the Behavior Tree tab: the robot is following its path.
```

### Status messages

SMACC2 and BehaviorTree.CPP do not publish these topics by themselves: a node on the robot publishes a status message with the fields MITI reads. The message definitions and an example publisher are in [State machine monitoring](../reference/state-machine.md). The status message package must be installed where foxglove_bridge runs, like the robot's other message packages. Until a status arrives, the tab shows **Waiting for data...**.

## Button Switch

A Button Switch sends one message when it is turned on and another when it is turned off. Set its **Button Label** and choose an **Action Mode**:

Publish Topic
: Publishes on **Topic** with **Message Type**, sending **ON Payload** or **OFF Payload** as JSON, for example `{"data": true}` and `{"data": false}` for `std_msgs/Bool`.

Call Service
: Calls **Service** with **ON Args** or **OFF Args** as the request.

```{figure} images/button-switch.webp
:alt: Button Switch settings with Publish Topic mode, topic, message type and ON and OFF payloads

Button Switch settings.
```

:::{warning}
A button switch acts on the robot as soon as it is pressed. Check the topic or service, the message type and both payloads before using it on a real robot.
:::

## Topics

The Topics panel lists every topic the bridge offers, with its message type. **Search topics** filters the list, the refresh button reloads it, and **Subscribe** shows a topic's latest message.
