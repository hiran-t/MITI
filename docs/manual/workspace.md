# The workspace

```{figure} images/overview.webp
:alt: The MITI workspace connected to a robot: the topic list, a 3D scene with the robot model, lidar points and costmap, a camera image with the lidar drawn over it, and the log

The workspace connected to a robot.
```

Title bar
: The MITI logo and the layout name on the left; **Reset layout** and **+ (Add panel)** on the right.

Activity bar
: The icons on the far left switch the sidebar between **Panel settings**, **Topics**, **Problems** and **Sources**. Clicking the active icon again hides the sidebar.

Sidebar
: Shows the settings of the selected panel, the topic list, connection problems or the connection state. Drag its edge to resize it; double-click the edge to reset its width.

Status bar
: The bridge address and connection state on the left, with the gear for the connection settings; the number of panels and MITI's version on the right.

## Add a panel

Click **+** at the top right and pick a panel:

```{figure} images/add-panel.webp
:alt: The Add panel menu listing Topics, 3D Scene, Point Cloud, Camera, State Machine, Button Switch and Log

The panels MITI offers.
```

| Panel         | Shows                                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Topics        | The bridge's topics, with a button to subscribe to each                 |
| 3D Scene      | The robot model, TF and 3D topics; see {doc}`3d-scene`                  |
| Point Cloud   | One point cloud topic on its own                                        |
| Camera        | A color or depth image, with 3D topics drawn over it; see {doc}`camera` |
| State Machine | SMACC2 state machines and behavior trees; see {doc}`other-panels`       |
| Button Switch | A button that publishes a message or calls a service                    |
| Log           | Messages from `/rosout`                                                 |

The new panel opens next to the selected one.

## Arrange panels

- **Select** a panel by clicking its tab; its settings open in the sidebar under **Panel settings**.
- **Move or split**: drag a panel's tab onto the edge of another panel.
- **Resize**: drag the line between two panels.
- **Expand** a panel to fill the workspace with the expand button on its tab, and restore it with the same button or **Esc**.
- **Lock** a panel's position with the lock button so it cannot be dragged away by mistake.
- **Close** a panel with the **×** on its tab.

**Reset layout** in the title bar goes back to the default panels after asking for confirmation. The layout is kept in the browser, so each browser has its own.

## Panel settings

Every panel has a **Title** and groups of settings that open and close. **Search panel settings** at the top filters them. Groups with an eye icon can be turned on and off, and the **⋮** menu next to a group or topic has more actions.
