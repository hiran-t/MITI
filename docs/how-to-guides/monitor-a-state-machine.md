# Monitor a State Machine

The State Machine panel follows a running [SMACC2](https://github.com/robosoft-ai/SMACC2) state machine or BehaviorTree.CPP behavior tree, so you can see what the robot is doing and why.

## Before you start

SMACC2 and BehaviorTree.CPP don't publish their state in a form MITI reads by themselves: a node on the robot publishes a status message with the fields MITI reads. The message definitions and an example publisher are in the [state machine messages reference](../reference/state-machine-messages.md).

## Add the panel

1. Click **+** in the title bar and choose **State Machine**.
2. Click its tab, and under **General** set **SMACC2 Status Topic** and **BehaviorTree Status Topic** to the topics the robot publishes.
3. Switch between the **SMACC2** and **Behavior Tree** tabs at the top of the panel.

## Read the SMACC2 tab

The **SMACC2** tab reads **SMACC2 Status Topic** (default `/smacc2/status`). It shows:

- the machine's ID, with **RUNNING** or **STOPPED**
- the **Current State** and the **Previous State**
- **All States**, with the current one highlighted
- the **Transition History**, newest first, with the time of each transition
- the time the last status arrived, at the bottom

```{figure} ../images/sm-smacc2.webp
:alt: The SMACC2 tab showing machine pick_and_place_sm running, current state GraspObject, previous state DetectObject, all six states and twelve transitions with their times

A pick-and-place state machine in the SMACC2 tab.
```

## Read the Behavior Tree tab

The **Behavior Tree** tab reads a BehaviorTree.CPP tree's execution from **BehaviorTree Status Topic** (default `/behavior_tree/execution_status`). It shows the tree's ID, how many times it has ticked and whether it runs, then one row per node with its type and status:

| Color  | Status  |
| ------ | ------- |
| Green  | SUCCESS |
| Red    | FAILURE |
| Yellow | RUNNING |
| Gray   | IDLE    |

Click a node that has children to collapse or expand it.

```{figure} ../images/sm-behavior-tree.webp
:alt: The Behavior Tree tab showing tree patrol_bt running with 1811 ticks, and nodes Root, PatrolLoop, BatteryOK, GoToWaypoint, ComputePathToPose, FollowPath, ClearCostmap, RetryUntilDocked, DockCheck and ReportStatus with their statuses

A patrol behavior tree in the Behavior Tree tab: the robot is following its path.
```

Until a status arrives, the tab shows **Waiting for data...**. The status message package must be installed where miti_bridge runs, like the robot's other message packages.
