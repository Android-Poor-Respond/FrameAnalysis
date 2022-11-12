# FrameAnalysis

<img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg">

This is a benchmark and analysis toolchain for Android slow rendering and frozen frame events.
The toolchain leverages UI Automator to automatically execute benchmark workloads on a device,
and customizes ``systrace`` (``atrace``) to realize continuous tracing of key rendering functions 
    (instead of only for several seconds by default) 
    during the benchmark to collect in-depth data for analysis.

## Getting Started

* Software Prerequisites

    Our toolchain is generally cross-platform with the major implementations using Python, JavaScript, and Shell (which currently is Linux/macOS-oriented but can also be used on Windows through msys2).
    To run it, you need to install Python 2 and nodejs.
    Also, you should have a workable Android development environment so that you can run `adb` commands.
    Apart from the above, we have no other special requirements.

* Toolchain Execution
    1. Device connection.

        To execute the toolchain, you should first eEnsure that ADB server has been started on your computer. You can do this through `adb start-server`.
        Then connect your device to the computer through USB of WiFi. 
        Make sure that you have turned on USB debugging in the developer options.

    2. Running the toolchain.

        To execute the toolchain,
            you can simple run the `run.sh` script in the `systrace` directory.
        After the benchmark is executed,
            the tracing data will be output to the `systrace/data` directory,
            which is a compressed archive with the code name of your device.

* Result Analysis

    To analyze the collected tracing data, you can execute the `run.sh` script under `analyzer`,
        which generates a JSON data file containing frame and root cause statistics.
    The JSON file's main data format is like
    ```json
    "frameData": [
    {// A frame's data
      "start": 10930290.461941406,  // start timestamp
      "duration": 47.32699999958277, // frame rendering time
      "cur_action": "Starting", // current benchmark action
      "proc_name": "com.google.android.googlequicksearchbox (pid 12546)", // process info
      "root_cause": [
        {
          "name": "Expensive Bitmap uploads"
        },
        {
          "name": "Running", // root cause name
          "score": 0.5631880321888248, // root cause correlation value
          "value": 26.653999999165535 // event time
        },
        {
          "name": "Blocking I/O delay",
          "score": 0.227755826625629,
          "value": 10.779000006616116
        },
        {
          "name": "Sleeping",
          "score": 0.13856783666489458,
          "value": 6.5580000057816505
        },
        {
          "name": "Not scheduled, but runnable",
          "score": 0.07048830452065157,
          "value": 3.3359999880194664
        }
      ]
    }, 
    // The other frames
    ]
    ```

    To do aggregated analysis, you can also leverage the `analysis.py` script under `FrameMonitor`,
        which parses the JSON file and can help you better get hands on analysis.

## Code Organization

* Benchmark Tools

    The benchmark tool involves the benchmark app that conducts automatic UI exercising (under `FrameBenchMark`), and the script to do preparations (`systrace/prepare.py`) such as installing the apps to be automated.

* Continuous Tracing Framework

    The tracing framework is implemented atop systrace (atrace) of Android,
        whose code resides in the `systrace` directory.
    Our customization allows us to instrument critical rendering functions in a continuous manner,
    rather than only for several seconds as in the original design of systrace.

* Root Cause Analysis

    The root cause analysis pipeline lies in `analyzer`.
    We implement this atop `systrace`'s visualization facility,
        which provides tools to parse the captured tracing data.

## Benchmark Workloads

The high-level actions performed as the benchmark workloads can be observed in a typical tracing data file as exemplified below:
```json
"framesByStages": {
    // data format
    // action: the number of frames rendered during the action
    "Starting": 67, 
    "Launching---WhatsApp": 923,
    "View feed---Instagram": 51,
    "View discovery---Instagram": 282,
    "Launching---Facebook": 21,
    "Refreshing---Facebook": 31,
    "Swiping---Facebook": 317,
    "Loading google.com---Chrome": 61,
    "Launching---Chrome": 50,
    "Loading youtube.com---Chrome": 93,
    "Swiping---Chrome": 243,
    "Loading twitter.com---Chrome": 113,
    "Loading qq.com---Chrome": 69,
    "Loading baidu.com---Chrome": 24,
    "Loading facebook.com---Chrome": 118,
    "Loading sohu.com---Chrome": 142,
    "Loading 360.cn---Chrome": 106,
    "Launching---Subway Surf": 37,
    "Entering game---Subway Surf": 31,
    "Entering game---Clash of Clans": 738,
    "Play game---Clash of Clans": 149,
    "Launching---Spotify": 31,
    "Swiping---Spotify": 103,
    "Playing musics---Spotify": 42,
    "Swiping---WhatsApp": 1426,
    "Swiping---YouTube": 659,
    "Playing videos---YouTube": 9,
    "Swiping---Gmail": 347,
    "Entering a mail---Gmail": 11,
    "Launching---Messenger": 16,
    "Click into User---Messenger": 26,
    "Refreshing---Messenger": 26,
    "Launching---Instagram": 116,
    "Swiping---Instagram": 417,
    "Refreshing---Instagram": 88
  }
```
Note that the numbers of rendered frame shown in the data are only examples extracted from a benchmark run on a typical device.
The specific actions performed can be found [here](https://github.com/Android-Poor-Respond/FrameAnalysis/blob/main/FrameBenchMark/app/src/androidTest/java/com/example/android/testing/uiautomator/FrameBench/AutoUITest.java).
In detail, for an app named `APPX`, the corresponding actions are contained in a `testAPPX` function in the file.
We have provided detailed documentation regarding each action performed in each stage.
For example,
    for Instagram, our actions include 
```java
public void testInstagram() {
        appName = "Instagram";
        BySelector selector;
        launchApp();

        if (isClean) {
            log("Login");
            selector = By.res("com.google.android.gms", "credential_primary_label");
            clickDefinitiveComponent(selector);
        }

        // wait till the main page shows up
        selector = By.res(mDevice.getCurrentPackageName(), "action_bar_inbox_button");
        mDevice.wait(Until.hasObject(selector), LONG_TIMEOUT);
        dumpHierarchy();

        // swipe to refresh
        log("Refreshing");
        mDevice.swipe(width/2, height/3, width/2, height/3*2, 5);
        mDevice.waitForIdle();
        dumpHierarchy();

        // scroll to view
        log("Swiping");
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }

        // open a feed
        log("View feed");
        selector = By.res(mDevice.getCurrentPackageName(), "row_feed_comment_textview_layout");
        mDevice.wait(Until.hasObject(selector), LAUNCH_TIMEOUT);
        if (mDevice.hasObject(selector)) {
            clickDefinitiveComponent(selector);
            dumpHierarchy();
            for (int i = 0; i < 10; i++) {
                mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
                mDevice.waitForIdle();
            }
            mDevice.pressBack();
        }

        // view discovery
        log("View discovery");
        selector = By.descContains("Search");
        clickDefinitiveComponent(selector);
        dumpHierarchy();
        for (int i = 0; i < 10; i++) {
            mDevice.swipe(width/2, height/3*2, width/2, height/3, 5);
            mDevice.waitForIdle();
        }
    }
```
Each app will perform its corresponding actions for ten times for each benchmark run.
Also, there will be a 3-minute cool-down between each iteration so as to avoid the side effect of device overheating.

## Contributing

The tool is far from optimal. We thank everyone willing to contribute to the project. Please file an issue or create a pull request to contribute. We expect all bug reports to contain full environment info, including that of host OSes and test phones.

