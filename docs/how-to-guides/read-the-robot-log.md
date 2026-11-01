# Read the Robot Log

The Log panel shows the robot's log messages from `/rosout`, the way `ros2 topic echo /rosout` would, but readable: each node's name gets its own color, so messages from different nodes are easy to tell apart.

## Add the Log panel

The default layout has a Log panel. Otherwise click **+** in the title bar and choose **Log**.

```{figure} ../images/log.webp
:alt: The Log panel with messages from /rosout, and its General and Display settings in the sidebar

The Log panel and its settings.
```

## Choose what to show

Click the Log panel's tab to open its settings.

Topic, Log level
: The log topic, usually `/rosout`, and the lowest level to show, from **DEBUG** to **FATAL**.

Namespaces
: Show or hide the messages of single nodes.

Display
: Font size, and whether each line shows its level, date, time, time zone, node name and source location.

## Search the messages

**Filter messages** at the top shows only lines that contain the text you type. The buttons next to it copy the shown messages and clear the panel. When you scroll up, new messages keep arriving below; **Latest** jumps back to them.
