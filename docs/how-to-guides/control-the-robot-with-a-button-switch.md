# Control the Robot with a Button Switch

A Button Switch sends one message when it is turned on and another when it is turned off, for example to switch a gripper, a light or a mode.

## Add a switch

1. Click **+** in the title bar and choose **Button Switch**.
2. Click its tab, set its **Button Label**, and choose an **Action Mode**:

   Publish Topic
   : Publishes on **Topic** with **Message Type**, sending **ON Payload** or **OFF Payload** as JSON, for example `{"data": true}` and `{"data": false}` for `std_msgs/Bool`.

   Call Service
   : Calls **Service** with **ON Args** or **OFF Args** as the request.

```{figure} ../images/button-switch.webp
:alt: Button Switch settings with Publish Topic mode, topic, message type and ON and OFF payloads

Button Switch settings.
```

## Use the switch

Click the switch: it turns **ON** and sends the ON payload (or calls the service with the ON arguments). Click it again to turn it **OFF** and send the OFF payload. The line at the bottom of the panel shows the topic or service it acts on.

:::{warning}
A button switch acts on the robot as soon as it is pressed. Check the topic or service, the message type and both payloads before using it on a real robot.
:::
